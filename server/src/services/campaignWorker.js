const mongoose = require('mongoose');
const {
  Campaign,
  CampaignRecipient,
  Contact,
  Conversation,
  Message,
  MessageTemplate,
  WhatsAppAccount,
} = require('../models');
const WhatsAppService = require('./whatsappService');
const { getSocketIO } = require('../sockets/socketServer');
const logger = require('../utils/logger');

// Active running campaign jobs
const activeWorkers = new Set();

class CampaignWorker {
  /**
   * Kicks off background dispatch for a campaign asynchronously
   */
  static startBackgroundJob(campaignId) {
    // Run detached in next tick so HTTP response returns immediately
    setImmediate(() => {
      this.dispatchCampaign(campaignId).catch((err) => {
        logger.error(`[CampaignWorker Fatal Error] Campaign ${campaignId}: ${err.message}`, err.stack);
      });
    });
  }

  /**
   * Main background processing loop
   */
  static async dispatchCampaign(campaignId) {
    if (activeWorkers.has(String(campaignId))) {
      logger.info(`[CampaignWorker] Campaign ${campaignId} is already being processed by worker`);
      return;
    }

    activeWorkers.add(String(campaignId));

    try {
      const campaign = await Campaign.findById(campaignId)
        .populate('templateId')
        .populate('whatsappAccountId');

      if (!campaign) {
        logger.warn(`[CampaignWorker] Campaign ${campaignId} not found`);
        return;
      }

      const template = campaign.templateId;
      if (!template) {
        campaign.status = 'FAILED';
        await campaign.save();
        return;
      }

      // Check Template status
      if (template.status !== 'APPROVED') {
        logger.warn(`[CampaignWorker] Template ${template.name} is not APPROVED (status: ${template.status})`);
        campaign.status = 'FAILED';
        await campaign.save();
        return;
      }

      // Resolve Credentials
      let account = campaign.whatsappAccountId;
      if (!account) {
        account = await WhatsAppAccount.findOne({
          workspaceId: campaign.workspaceId,
          status: { $ne: 'disconnected' },
        });
      }

      const phoneNumberId = account?.phoneNumberId || process.env.META_PHONE_NUMBER_ID;
      const accessToken = account?.accessTokenEncrypted || process.env.META_ACCESS_TOKEN;

      campaign.status = 'PROCESSING';
      campaign.startedAt = campaign.startedAt || new Date();
      await campaign.save();

      const io = getSocketIO();
      if (io) {
        io.to(`workspace_${campaign.workspaceId}`).emit('campaign:updated', { campaign });
      }

      // Fetch queued recipients for this campaign
      const queuedRecipients = await CampaignRecipient.find({
        campaignId: campaign._id,
        status: 'queued',
      }).populate('contactId');

      logger.info(`[CampaignWorker] Starting batch dispatch of ${queuedRecipients.length} recipients for campaign "${campaign.name}"`);

      let sentCount = campaign.statistics.sent || 0;
      let failedCount = campaign.statistics.failed || 0;

      for (const recipient of queuedRecipients) {
        // Check if campaign was paused or cancelled by user mid-flight
        const freshCampaign = await Campaign.findById(campaign._id).select('status');
        if (freshCampaign && ['PAUSED', 'paused', 'CANCELLED', 'cancelled'].includes(freshCampaign.status)) {
          logger.info(`[CampaignWorker] Campaign ${campaign._id} was paused/cancelled. Halting dispatch worker.`);
          break;
        }

        const contact = recipient.contactId;

        // WhatsApp Opt-Out Compliance Check
        if (!contact || contact.optedOut) {
          recipient.status = 'failed';
          recipient.error = { reason: 'Contact has opted out of WhatsApp broadcasts' };
          await recipient.save();
          failedCount++;
          continue;
        }

        // Atomic update to ensure recipient is not processed twice
        const lock = await CampaignRecipient.findOneAndUpdate(
          { _id: recipient._id, status: 'queued' },
          { $set: { status: 'sent' } },
          { new: true }
        );

        if (!lock) {
          // Already claimed by another worker tick
          continue;
        }

        try {
          // Build template components & parameter variables
          const contactName = contact.name || 'Valued Customer';
          const contactPhone = contact.phoneNumber;

          const components = [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: contactName },
                { type: 'text', text: contactPhone },
              ],
            },
          ];

          let metaRes = null;
          let whatsappMessageId = `cmp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

          if (phoneNumberId && accessToken) {
            metaRes = await WhatsAppService.sendTemplateMessage({
              to: recipient.phoneNumber,
              templateName: template.name,
              languageCode: template.language || 'en_US',
              components,
              phoneNumberId,
              accessToken,
            });

            if (metaRes?.messages?.[0]?.id) {
              whatsappMessageId = metaRes.messages[0].id;
            }
          }

          recipient.status = 'sent';
          recipient.whatsappMessageId = whatsappMessageId;
          recipient.sentAt = new Date();
          await recipient.save();

          // Create/Update Conversation & Message in MongoDB
          let conversation = await Conversation.findOne({
            workspaceId: campaign.workspaceId,
            contactId: contact._id,
          });

          if (!conversation) {
            conversation = await Conversation.create({
              workspaceId: campaign.workspaceId,
              contactId: contact._id,
              whatsappAccountId: account?._id || null,
              status: 'open',
              unreadCount: 0,
            });
          }

          const msgBody = template.body.replace(/\{\{1\}\}/g, contactName).replace(/\{\{2\}\}/g, contactPhone);

          await Message.create({
            workspaceId: campaign.workspaceId,
            conversationId: conversation._id,
            contactId: contact._id,
            whatsappAccountId: account?._id || null,
            whatsappMessageId,
            direction: 'outbound',
            type: 'template',
            body: msgBody,
            status: 'sent',
            metadata: {
              campaignId: campaign._id,
              templateName: template.name,
            },
          });

          conversation.lastMessage = {
            body: msgBody,
            type: 'template',
            direction: 'outbound',
            status: 'sent',
            timestamp: new Date(),
          };
          conversation.lastMessageAt = new Date();
          await conversation.save();

          sentCount++;
        } catch (dispatchErr) {
          logger.warn(`[CampaignWorker] Failed to send to ${recipient.phoneNumber}: ${dispatchErr.message}`);
          recipient.status = 'failed';
          recipient.error = { message: dispatchErr.message, metaDetails: dispatchErr.metaDetails };
          await recipient.save();
          failedCount++;
        }

        // WhatsApp Rate Limiting Pause (e.g. 50ms between messages)
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // Update Final Statistics
      const remainingQueued = await CampaignRecipient.countDocuments({
        campaignId: campaign._id,
        status: 'queued',
      });

      campaign.statistics.sent = sentCount;
      campaign.statistics.failed = failedCount;
      campaign.statistics.queued = remainingQueued;

      if (remainingQueued === 0 && !['PAUSED', 'paused', 'CANCELLED', 'cancelled'].includes(campaign.status)) {
        campaign.status = 'COMPLETED';
        campaign.completedAt = new Date();
      }

      await campaign.save();

      if (io) {
        io.to(`workspace_${campaign.workspaceId}`).emit('campaign:updated', { campaign });
      }

      logger.info(`[CampaignWorker] Campaign "${campaign.name}" processing finished. Sent: ${sentCount}, Failed: ${failedCount}, Remaining: ${remainingQueued}`);
    } catch (err) {
      logger.error(`[CampaignWorker Error] ${err.message}`, err.stack);
    } finally {
      activeWorkers.delete(String(campaignId));
    }
  }
}

module.exports = CampaignWorker;
