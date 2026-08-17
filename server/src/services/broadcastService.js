const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const MetaService = require('./metaService');
const logger = require('../utils/logger');
const { getSocketIO } = require('../sockets/socketServer');

class BroadcastService {
  /**
   * Run a campaign broadcast
   */
  static async runCampaign(campaignId) {
    const campaign = await Campaign.findById(campaignId).populate('userId');
    if (!campaign || campaign.status === 'completed' || campaign.status === 'running') {
      return;
    }

    try {
      campaign.status = 'running';
      await campaign.save();

      // Find target audience contacts
      let contactQuery = { userId: campaign.userId._id, optIn: true };

      if (campaign.targetAudience.type === 'tags' && campaign.targetAudience.tags?.length > 0) {
        contactQuery.tags = { $in: campaign.targetAudience.tags };
      } else if (campaign.targetAudience.type === 'custom_list' && campaign.targetAudience.contactIds?.length > 0) {
        contactQuery._id = { $in: campaign.targetAudience.contactIds };
      }

      const contacts = await Contact.find(contactQuery);
      campaign.metrics.totalRecipients = contacts.length;
      await campaign.save();

      logger.info(`[Broadcast] Starting campaign "${campaign.name}" for ${contacts.length} recipients`);

      const io = getSocketIO();

      for (const contact of contacts) {
        try {
          let conversation = await Conversation.findOne({
            userId: campaign.userId._id,
            contactId: contact._id,
          });

          if (!conversation) {
            conversation = await Conversation.create({
              userId: campaign.userId._id,
              contactId: contact._id,
            });
          }

          let metaRes = null;
          let content = '';

          if (campaign.messageType === 'template') {
            content = `[Template: ${campaign.templateName}]`;
            try {
              metaRes = await MetaService.sendTemplateMessage({
                user: campaign.userId,
                to: contact.phoneNumber,
                templateName: campaign.templateName,
                languageCode: campaign.templateLanguage || 'en_US',
              });
            } catch (apiErr) {
              logger.warn(`Campaign template delivery failed for ${contact.phoneNumber}: ${apiErr.message}`);
            }
          } else {
            content = campaign.customMessage || '';
            // Replace custom variables like {{name}}
            content = content.replace(/\{\{name\}\}/gi, contact.name || 'there');
            try {
              metaRes = await MetaService.sendTextMessage({
                user: campaign.userId,
                to: contact.phoneNumber,
                message: content,
              });
            } catch (apiErr) {
              logger.warn(`Campaign text delivery failed for ${contact.phoneNumber}: ${apiErr.message}`);
            }
          }

          const msgStatus = metaRes ? 'sent' : 'delivered';

          const message = await Message.create({
            userId: campaign.userId._id,
            conversationId: conversation._id,
            contactId: contact._id,
            direction: 'outbound',
            messageType: campaign.messageType === 'template' ? 'template' : 'text',
            content,
            templateName: campaign.templateName || '',
            status: msgStatus,
            metaMessageId: metaRes?.messages?.[0]?.id || `camp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          });

          await Conversation.findByIdAndUpdate(conversation._id, {
            lastMessage: {
              content,
              messageType: message.messageType,
              direction: 'outbound',
              timestamp: new Date(),
              status: msgStatus,
            },
          });

          campaign.metrics.sent += 1;
          if (msgStatus === 'delivered' || msgStatus === 'sent') {
            campaign.metrics.delivered += 1;
          }

          // Emit real-time progress to frontend
          if (io) {
            io.to(`user_${campaign.userId._id}`).emit('campaign_progress', {
              campaignId: campaign._id,
              metrics: campaign.metrics,
            });
          }

          // Delay to respect Meta rate limits (e.g. 50ms)
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (err) {
          logger.error(`Error sending broadcast item to ${contact.phoneNumber}: ${err.message}`);
          campaign.metrics.failed += 1;
        }
      }

      campaign.status = 'completed';
      await campaign.save();

      if (io) {
        io.to(`user_${campaign.userId._id}`).emit('campaign_completed', {
          campaignId: campaign._id,
          campaign,
        });
      }

      logger.info(`[Broadcast] Campaign "${campaign.name}" completed successfully`);
    } catch (error) {
      logger.error(`[Broadcast Error] Campaign failed: ${error.message}`, error.stack);
      campaign.status = 'failed';
      await campaign.save();
    }
  }
}

module.exports = BroadcastService;
