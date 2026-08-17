const crypto = require('crypto');
const {
  WhatsAppAccount,
  Workspace,
  Contact,
  Conversation,
  Message,
  CampaignRecipient,
} = require('../models');
const AutomationEngine = require('../services/automationEngine');
const WhatsAppService = require('../services/whatsappService');
const { getSocketIO } = require('../sockets/socketServer');
const logger = require('../utils/logger');

/**
 * 1. Verify Meta Webhook (GET)
 * Validates hub.mode, hub.verify_token, and responds with hub.challenge
 */
const verifyWebhook = async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const expectedToken = process.env.META_VERIFY_TOKEN || 'nexaflow_verify_token_prod';

    if (mode === 'subscribe' && token) {
      if (token === expectedToken) {
        logger.info('[WEBHOOK] Meta challenge verification succeeded');
        return res.status(200).send(challenge);
      }

      // Also check if any configured WhatsAppAccount has this verifyToken
      const account = await WhatsAppAccount.findOne({
        'metadata.verifyToken': token,
      });

      if (account) {
        logger.info(`[WEBHOOK] Verification succeeded for WhatsApp account: ${account.phoneNumber}`);
        return res.status(200).send(challenge);
      }
    }

    logger.warn(`[WEBHOOK] Verification rejected. Token mismatch.`);
    return res.status(403).json({
      success: false,
      error: 'Verification token mismatch',
    });
  } catch (error) {
    logger.error(`[WEBHOOK] Verify error: ${error.message}`);
    return res.status(500).send('Internal Server Error');
  }
};

/**
 * Validates Meta request signature using META_APP_SECRET
 */
const verifyMetaSignature = (req) => {
  const appSecret = process.env.META_APP_SECRET;
  const signature = req?.headers?.['x-hub-signature-256'];

  if (!appSecret || !signature) {
    return true; // If no app secret configured in dev or no signature, allow passage
  }

  try {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const hmac = crypto.createHmac('sha256', appSecret);
    hmac.update(rawBody);
    const expectedSignature = `sha256=${hmac.digest('hex')}`;

    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (err) {
    logger.warn(`[WEBHOOK] Signature check error: ${err.message}`);
    return false;
  }
};

/**
 * 2. Handle Incoming Webhook Events (POST)
 */
const handleWebhookEvent = async (req, res) => {
  // Acknowledge receipt to Meta immediately with 200 OK
  res.status(200).send('EVENT_RECEIVED');

  try {
    // Verify signature if secret is present
    if (!verifyMetaSignature(req)) {
      logger.warn('[WEBHOOK] Warning: Invalid Meta X-Hub-Signature-256 signature');
    }

    const body = req.body;
    if (!body || body.object !== 'whatsapp_business_account') {
      return;
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;
        const value = change.value;
        if (!value) continue;

        const phoneNumberId = value.metadata?.phone_number_id;

        // 1. Locate WhatsAppAccount & Workspace
        let account = null;
        if (phoneNumberId) {
          account = await WhatsAppAccount.findOne({ phoneNumberId });
        }

        if (!account) {
          // Fallback to first active account
          account = await WhatsAppAccount.findOne({ status: { $ne: 'disconnected' } });
        }

        let workspace = null;
        if (account && account.workspaceId) {
          workspace = await Workspace.findById(account.workspaceId);
        }

        if (!workspace) {
          workspace = await Workspace.findOne().sort({ createdAt: 1 });
        }

        if (!workspace) {
          logger.warn(`[WEBHOOK] No workspace found to associate with phone_number_id ${phoneNumberId}`);
          continue;
        }

        // 2. Process Status Updates (sent, delivered, read, failed)
        if (Array.isArray(value.statuses) && value.statuses.length > 0) {
          for (const statusObj of value.statuses) {
            await processStatusUpdate(workspace, statusObj);
          }
        }

        // 3. Process Incoming Messages
        if (Array.isArray(value.messages) && value.messages.length > 0) {
          for (const messageObj of value.messages) {
            const contactProfileName = value.contacts?.[0]?.profile?.name || '';
            await processIncomingMessage(workspace, account, messageObj, contactProfileName);
          }
        }
      }
    }
  } catch (error) {
    // Unknown webhook events must not crash the server
    logger.error(`[WEBHOOK] Processing Error: ${error.message}`, error.stack);
  }
};

/**
 * Handle message status updates (sent, delivered, read, failed)
 */
async function processStatusUpdate(workspace, statusObj) {
  try {
    const whatsappMessageId = statusObj.id;
    const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
    const timestamp = statusObj.timestamp ? new Date(parseInt(statusObj.timestamp, 10) * 1000) : new Date();

    const message = await Message.findOne({ whatsappMessageId });
    if (!message) return;

    message.status = status;

    if (status === 'failed' && statusObj.errors && statusObj.errors.length > 0) {
      const err = statusObj.errors[0];
      message.error = {
        code: String(err.code || 'UNKNOWN'),
        message: err.message || err.title || 'Message delivery failed',
        details: err,
      };
    }

    await message.save();

    // Update conversation if this was the last message
    await Conversation.findOneAndUpdate(
      { _id: message.conversationId },
      { 'lastMessage.status': status }
    );

    // Update Campaign Recipient record if linked
    if (message.contactId) {
      const updateFields = { status };
      if (status === 'sent') updateFields.sentAt = timestamp;
      if (status === 'delivered') updateFields.deliveredAt = timestamp;
      if (status === 'read') updateFields.readAt = timestamp;
      if (message.error) updateFields.error = message.error;

      await CampaignRecipient.findOneAndUpdate(
        { contactId: message.contactId },
        updateFields
      );
    }

    // Emit real-time status update via Socket.IO
    const io = getSocketIO();
    if (io) {
      io.to(`workspace_${workspace._id}`).emit('message:updated', {
        messageId: message._id,
        conversationId: message.conversationId,
        whatsappMessageId,
        status,
        timestamp,
      });
      io.to(`workspace_${workspace._id}`).emit('message_status_updated', {
        messageId: message._id,
        conversationId: message.conversationId,
        whatsappMessageId,
        status,
        timestamp,
      });
    }
  } catch (err) {
    logger.error(`[WEBHOOK] Process Status Error: ${err.message}`);
  }
}

/**
 * Handle incoming WhatsApp message
 */
async function processIncomingMessage(workspace, account, messageObj, contactProfileName) {
  try {
    const fromPhone = String(messageObj.from).replace(/[^0-9]/g, '');
    const messageId = messageObj.id;
    const type = messageObj.type || 'text';

    logger.info(`[WEBHOOK] Incoming message received from ${fromPhone} (MsgID: ${messageId}, Type: ${type})`);

    // 1. Idempotency Check: prevent duplicate messages if webhook arrives twice
    const existingMessage = await Message.findOne({ whatsappMessageId: messageId });
    if (existingMessage) {
      logger.info(`[WEBHOOK] Duplicate message detected. Skipping: ${messageId}`);
      return;
    }

    // 2. Parse payload based on message type
    let body = '';
    let media = { url: '', mimeType: '', fileName: '', fileSize: 0, caption: '', id: '' };
    let interactiveData = null;

    switch (type) {
      case 'text':
        body = messageObj.text?.body || '';
        break;

      case 'image':
        body = messageObj.image?.caption || '[Image]';
        media = {
          id: messageObj.image?.id || '',
          mimeType: messageObj.image?.mime_type || 'image/jpeg',
          caption: messageObj.image?.caption || '',
          url: messageObj.image?.url || '',
        };
        break;

      case 'audio':
        body = '[Audio Message]';
        media = {
          id: messageObj.audio?.id || '',
          mimeType: messageObj.audio?.mime_type || 'audio/ogg',
          url: messageObj.audio?.url || '',
        };
        break;

      case 'video':
        body = messageObj.video?.caption || '[Video]';
        media = {
          id: messageObj.video?.id || '',
          mimeType: messageObj.video?.mime_type || 'video/mp4',
          caption: messageObj.video?.caption || '',
          url: messageObj.video?.url || '',
        };
        break;

      case 'document':
        body = messageObj.document?.caption || `[Document: ${messageObj.document?.filename || 'file'}]`;
        media = {
          id: messageObj.document?.id || '',
          fileName: messageObj.document?.filename || '',
          mimeType: messageObj.document?.mime_type || 'application/pdf',
          caption: messageObj.document?.caption || '',
          url: messageObj.document?.url || '',
        };
        break;

      case 'location': {
        const loc = messageObj.location || {};
        body = loc.name ? `[Location: ${loc.name}] ${loc.address || ''}` : `[Location: ${loc.latitude}, ${loc.longitude}]`;
        media = {
          caption: body,
          url: `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`,
        };
        break;
      }

      case 'interactive':
        if (messageObj.interactive?.type === 'button_reply') {
          body = messageObj.interactive.button_reply?.title || '';
          interactiveData = {
            type: 'button_reply',
            buttonId: messageObj.interactive.button_reply?.id || '',
            buttonTitle: body,
          };
        } else if (messageObj.interactive?.type === 'list_reply') {
          body = messageObj.interactive.list_reply?.title || '';
          interactiveData = {
            type: 'list_reply',
            listId: messageObj.interactive.list_reply?.id || '',
            listTitle: body,
            description: messageObj.interactive.list_reply?.description || '',
          };
        }
        break;

      case 'button':
        body = messageObj.button?.text || '';
        interactiveData = {
          type: 'button',
          buttonId: messageObj.button?.payload || '',
          buttonTitle: body,
        };
        break;

      default:
        body = `[${type.toUpperCase()}]`;
        break;
    }

    // 3. Find or create Contact
    let isNewContact = false;
    let contact = await Contact.findOne({
      workspaceId: workspace._id,
      phoneNumber: fromPhone,
    });

    if (!contact) {
      isNewContact = true;
      contact = await Contact.create({
        workspaceId: workspace._id,
        phoneNumber: fromPhone,
        whatsappId: fromPhone,
        name: contactProfileName || fromPhone,
        lastInteractionAt: new Date(),
      });
      logger.info(`[CONTACT] Contact created: ${contact._id} (${contact.name})`);
    } else {
      contact.lastInteractionAt = new Date();
      if (contactProfileName && (contact.name === 'WhatsApp User' || contact.name === fromPhone)) {
        contact.name = contactProfileName;
      }
      await contact.save();
      logger.info(`[CONTACT] Contact found: ${contact._id} (${contact.name})`);
    }

    // 4. Find or create Conversation
    let isNewConversation = false;
    let conversation = await Conversation.findOne({
      workspaceId: workspace._id,
      contactId: contact._id,
    });

    const mappedType = ['text', 'image', 'audio', 'video', 'document', 'location', 'interactive'].includes(type)
      ? type
      : 'text';

    if (!conversation) {
      isNewConversation = true;
      conversation = await Conversation.create({
        workspaceId: workspace._id,
        contactId: contact._id,
        whatsappAccountId: account?._id || null,
        unreadCount: 1,
        status: 'open',
        lastMessage: {
          body,
          type: mappedType,
          direction: 'inbound',
          status: 'received',
          timestamp: new Date(),
        },
        lastMessageAt: new Date(),
      });
      logger.info(`[CONVERSATION] Conversation created: ${conversation._id}`);
    } else {
      conversation.unreadCount = (conversation.unreadCount || 0) + 1;
      conversation.status = 'open';
      conversation.lastMessage = {
        body,
        type: mappedType,
        direction: 'inbound',
        status: 'received',
        timestamp: new Date(),
      };
      conversation.lastMessageAt = new Date();
      if (account?._id) {
        conversation.whatsappAccountId = account._id;
      }
      await conversation.save();
      logger.info(`[CONVERSATION] Conversation found/updated: ${conversation._id}`);
    }

    // 5. Create Message in MongoDB
    const createdMessage = await Message.create({
      workspaceId: workspace._id,
      conversationId: conversation._id,
      contactId: contact._id,
      whatsappAccountId: account?._id || null,
      whatsappMessageId: messageId,
      direction: 'inbound',
      type: mappedType,
      body,
      media,
      status: 'received',
      metadata: messageObj,
    });
    logger.info(`[MESSAGE] Incoming message saved: ${createdMessage._id}`);

    // 6. Optional: Send read receipt to WhatsApp
    const phoneNumberId = account?.phoneNumberId || process.env.META_PHONE_NUMBER_ID;
    const accessToken = account?.accessTokenEncrypted || process.env.META_ACCESS_TOKEN;
    if (phoneNumberId && accessToken && messageId) {
      WhatsAppService.markAsRead({ messageId, phoneNumberId, accessToken }).catch(() => {});
    }

    // 7. Emit Socket.IO events to workspace room
    const io = getSocketIO();
    if (io) {
      if (isNewConversation) {
        io.to(`workspace_${workspace._id}`).emit('conversation:new', { conversation, contact });
      }

      io.to(`workspace_${workspace._id}`).emit('message:new', {
        conversationId: conversation._id,
        contact,
        message: createdMessage,
      });
      io.to(`workspace_${workspace._id}`).emit('new_message', {
        conversationId: conversation._id,
        contact,
        message: createdMessage,
      });

      io.to(`workspace_${workspace._id}`).emit('conversation:updated', {
        conversation,
      });
      io.to(`workspace_${workspace._id}`).emit('conversation_updated', {
        conversation,
      });
    }

    // 8. Run Real Automation Engine
    await AutomationEngine.processIncomingMessage({
      workspace,
      account,
      contact,
      conversation,
      message: createdMessage,
      incomingText: body,
      interactiveData,
    });
  } catch (err) {
    logger.error(`[WEBHOOK] Process incoming message error: ${err.message}`, err.stack);
  }
}

module.exports = {
  verifyWebhook,
  handleWebhookEvent,
};
