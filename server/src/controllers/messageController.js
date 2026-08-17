const WhatsAppService = require('../services/whatsappService');
const { WhatsAppAccount, Contact, Conversation, Message } = require('../models');
const { sendSuccess, sendError } = require('../utils/response');
const { getSocketIO } = require('../sockets/socketServer');
const logger = require('../utils/logger');

/**
 * Helper to resolve WhatsApp Account credentials for the workspace
 */
const getWorkspaceWhatsAppCredentials = async (workspaceId) => {
  let account = await WhatsAppAccount.findOne({
    workspaceId,
    status: { $ne: 'disconnected' },
  });

  const envPhoneId = process.env.META_PHONE_NUMBER_ID;
  const envToken = process.env.META_ACCESS_TOKEN;

  if (!account && envPhoneId && envToken) {
    try {
      account = await WhatsAppAccount.create({
        workspaceId,
        phoneNumber: process.env.META_DISPLAY_PHONE_NUMBER || '+15550234567',
        phoneNumberId: envPhoneId,
        businessAccountId: process.env.META_BUSINESS_ACCOUNT_ID || '',
        displayName: 'WhatsApp Business',
        accessTokenEncrypted: envToken,
        status: 'connected',
      });
    } catch (e) {
      // If already exists concurrently
      account = await WhatsAppAccount.findOne({ workspaceId });
    }
  }

  const phoneNumberId = account?.phoneNumberId || envPhoneId;
  const accessToken = account?.accessTokenEncrypted || envToken;

  return { account, phoneNumberId, accessToken };
};

/**
 * Send WhatsApp message
 * POST /api/messages/send
 */
const sendMessage = async (req, res, next) => {
  try {
    const {
      to,
      type = 'text',
      text,
      body,
      content,
      mediaUrl,
      caption,
      filename,
      templateName,
      languageCode = 'en_US',
      components = [],
      previewUrl = false,
      contactName,
    } = req.body;

    if (!to) {
      return sendError(res, 'Recipient phone number (to) is required', 400);
    }

    const messageText = text || body || content || '';
    const cleanedPhone = String(to).replace(/[^0-9]/g, '');

    if (!cleanedPhone || cleanedPhone.length < 7) {
      return sendError(res, 'Invalid recipient phone number format', 400);
    }

    // 1. Find WhatsApp Account for this workspace
    const { account, phoneNumberId, accessToken } = await getWorkspaceWhatsAppCredentials(req.workspaceId);

    if (!phoneNumberId || !accessToken) {
      return sendError(
        res,
        'Meta WhatsApp Cloud API credentials are not configured for this workspace. Please configure your Phone Number ID and Access Token.',
        400
      );
    }

    // 2. Find or create Contact in MongoDB
    let contact = await Contact.findOne({
      workspaceId: req.workspaceId,
      phoneNumber: cleanedPhone,
    });

    if (!contact) {
      contact = await Contact.create({
        workspaceId: req.workspaceId,
        phoneNumber: cleanedPhone,
        whatsappId: cleanedPhone,
        name: contactName || 'WhatsApp User',
        lastInteractionAt: new Date(),
      });
    } else {
      contact.lastInteractionAt = new Date();
      await contact.save();
    }

    // 3. Find or create Conversation in MongoDB
    let conversation = await Conversation.findOne({
      workspaceId: req.workspaceId,
      contactId: contact._id,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        workspaceId: req.workspaceId,
        contactId: contact._id,
        whatsappAccountId: account?._id || null,
        status: 'open',
        unreadCount: 0,
      });
    }

    // 4. Dispatch to Meta WhatsApp Cloud API
    let metaResponse = null;
    const messageType = type.toLowerCase();

    switch (messageType) {
      case 'text':
        if (!messageText.trim()) {
          return sendError(res, 'Message text is required for text messages', 400);
        }
        metaResponse = await WhatsAppService.sendTextMessage({
          to: cleanedPhone,
          text: messageText,
          previewUrl,
          phoneNumberId,
          accessToken,
        });
        break;

      case 'image':
        if (!mediaUrl) {
          return sendError(res, 'mediaUrl is required for image messages', 400);
        }
        metaResponse = await WhatsAppService.sendImageMessage({
          to: cleanedPhone,
          imageUrl: mediaUrl,
          caption: caption || messageText,
          phoneNumberId,
          accessToken,
        });
        break;

      case 'document':
        if (!mediaUrl) {
          return sendError(res, 'mediaUrl is required for document messages', 400);
        }
        metaResponse = await WhatsAppService.sendDocumentMessage({
          to: cleanedPhone,
          documentUrl: mediaUrl,
          filename,
          caption: caption || messageText,
          phoneNumberId,
          accessToken,
        });
        break;

      case 'audio':
        if (!mediaUrl) {
          return sendError(res, 'mediaUrl is required for audio messages', 400);
        }
        metaResponse = await WhatsAppService.sendAudioMessage({
          to: cleanedPhone,
          audioUrl: mediaUrl,
          phoneNumberId,
          accessToken,
        });
        break;

      case 'video':
        if (!mediaUrl) {
          return sendError(res, 'mediaUrl is required for video messages', 400);
        }
        metaResponse = await WhatsAppService.sendVideoMessage({
          to: cleanedPhone,
          videoUrl: mediaUrl,
          caption: caption || messageText,
          phoneNumberId,
          accessToken,
        });
        break;

      case 'template':
        if (!templateName) {
          return sendError(res, 'templateName is required for template messages', 400);
        }
        metaResponse = await WhatsAppService.sendTemplateMessage({
          to: cleanedPhone,
          templateName,
          languageCode,
          components,
          phoneNumberId,
          accessToken,
        });
        break;

      default:
        return sendError(
          res,
          `Unsupported message type: '${messageType}'. Supported types: text, image, document, audio, video, template`,
          400
        );
    }

    const whatsappMessageId =
      metaResponse?.messages?.[0]?.id || `wamid.${Date.now()}.${Math.random().toString(36).substring(7)}`;

    // 5. Store Message in MongoDB
    const messageDoc = await Message.create({
      workspaceId: req.workspaceId,
      conversationId: conversation._id,
      contactId: contact._id,
      whatsappAccountId: account?._id || null,
      whatsappMessageId,
      direction: 'outbound',
      type: messageType,
      body: messageText || caption || `[${messageType.toUpperCase()}]`,
      media: {
        url: mediaUrl || '',
        fileName: filename || '',
        caption: caption || '',
      },
      status: 'sent',
      metadata: metaResponse,
    });

    // 6. Update Conversation
    conversation.lastMessage = {
      body: messageDoc.body,
      type: messageType,
      direction: 'outbound',
      status: 'sent',
      timestamp: new Date(),
    };
    conversation.lastMessageAt = new Date();
    conversation.status = 'open';
    if (account?._id) {
      conversation.whatsappAccountId = account._id;
    }
    await conversation.save();

    // 7. Emit Real-time Socket Event
    const io = getSocketIO();
    if (io) {
      io.to(`workspace_${req.workspaceId}`).emit('new_message', {
        conversationId: conversation._id,
        message: messageDoc,
      });
    }

    return sendSuccess(
      res,
      'WhatsApp message dispatched and stored successfully',
      {
        message: messageDoc,
        conversationId: conversation._id,
        contactId: contact._id,
        whatsappMessageId,
      },
      201
    );
  } catch (error) {
    logger.error(`[MessageController Error] ${error.message}`);
    const statusCode = error.status || 500;
    return sendError(res, error.message, statusCode, error.metaDetails || null);
  }
};

/**
 * Get message history for a conversation
 * GET /api/messages/:conversationId
 */
const getMessagesByConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { limit = 50, page = 1 } = req.query;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      workspaceId: req.workspaceId,
    });

    if (!conversation) {
      return sendError(res, 'Conversation not found in this workspace', 404);
    }

    const messages = await Message.find({
      conversationId: conversation._id,
      workspaceId: req.workspaceId,
    })
      .sort({ createdAt: 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await Message.countDocuments({
      conversationId: conversation._id,
      workspaceId: req.workspaceId,
    });

    return sendSuccess(res, 'Messages retrieved', {
      conversation,
      messages,
      total,
      page: parseInt(page),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendMessage,
  getMessagesByConversation,
};
