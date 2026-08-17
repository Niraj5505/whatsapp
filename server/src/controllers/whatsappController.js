const mongoose = require('mongoose');
const {
  WhatsAppAccount,
  Contact,
  Conversation,
  Message,
} = require('../models');
const WhatsAppService = require('../services/whatsappService');
const AutomationEngine = require('../services/automationEngine');
const { getSocketIO } = require('../sockets/socketServer');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * 1. Get WhatsApp Account Status in Workspace
 * GET /api/whatsapp
 */
const getWhatsAppStatus = async (req, res, next) => {
  try {
    const accounts = await WhatsAppAccount.find({
      workspaceId: req.workspaceId,
    }).select('-accessTokenEncrypted'); // NEVER expose encrypted or raw access tokens

    return sendSuccess(res, 'WhatsApp accounts retrieved', { accounts });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Connect / Update WhatsApp Cloud API Credentials in Workspace
 * POST /api/whatsapp/connect
 */
const connectWhatsAppAccount = async (req, res, next) => {
  try {
    const { phoneNumberId, businessAccountId, displayName, phoneNumber, accessToken } = req.body;

    if (!phoneNumberId || !accessToken) {
      return sendError(res, 'Phone Number ID and Access Token are required', 400);
    }

    let account = await WhatsAppAccount.findOne({
      workspaceId: req.workspaceId,
    });

    if (account) {
      account.phoneNumberId = phoneNumberId.trim();
      account.businessAccountId = businessAccountId ? businessAccountId.trim() : account.businessAccountId;
      account.displayName = displayName ? displayName.trim() : account.displayName;
      account.phoneNumber = phoneNumber ? phoneNumber.trim() : account.phoneNumber;
      account.accessTokenEncrypted = accessToken.trim();
      account.status = 'connected';
      await account.save();
    } else {
      account = await WhatsAppAccount.create({
        workspaceId: req.workspaceId,
        phoneNumberId: phoneNumberId.trim(),
        businessAccountId: businessAccountId ? businessAccountId.trim() : '',
        displayName: displayName ? displayName.trim() : 'NexaFlow WhatsApp',
        phoneNumber: phoneNumber ? phoneNumber.trim() : '',
        accessTokenEncrypted: accessToken.trim(),
        status: 'connected',
      });
    }

    return sendSuccess(res, 'WhatsApp Cloud API credentials connected securely', {
      account: {
        id: account._id,
        phoneNumberId: account.phoneNumberId,
        businessAccountId: account.businessAccountId,
        displayName: account.displayName,
        phoneNumber: account.phoneNumber,
        status: account.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Send Direct Test Message
 * POST /api/whatsapp/send-test
 */
const sendTestMessage = async (req, res, next) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return sendError(res, 'Recipient phone number and message body are required', 400);
    }

    const account = await WhatsAppAccount.findOne({
      workspaceId: req.workspaceId,
      status: { $ne: 'disconnected' },
    });

    const phoneNumberId = account?.phoneNumberId || process.env.META_PHONE_NUMBER_ID;
    const accessToken = account?.accessTokenEncrypted || process.env.META_ACCESS_TOKEN;

    const metaRes = await WhatsAppService.sendTextMessage({
      to,
      text: message,
      phoneNumberId,
      accessToken,
    });

    return sendSuccess(res, 'Test WhatsApp message sent successfully via Meta Cloud API', {
      response: {
        messageId: metaRes?.messages?.[0]?.id || 'mock_msg_id',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Simulate Incoming WhatsApp Message (For testing & development)
 * POST /api/whatsapp/simulate-incoming
 */
const simulateIncomingMessage = async (req, res, next) => {
  try {
    const { fromPhone, contactName, messageText } = req.body;
    const cleanPhone = (fromPhone || '+15550010001').replace(/[^0-9]/g, '');
    const cleanText = messageText || 'Hello!';

    // 1. Contact (Scoped to workspace)
    let contact = await Contact.findOne({
      workspaceId: req.workspaceId,
      phoneNumber: cleanPhone,
    });

    if (!contact) {
      contact = await Contact.create({
        workspaceId: req.workspaceId,
        phoneNumber: cleanPhone,
        name: contactName || 'Simulation Lead',
        lastInteractionAt: new Date(),
      });
    } else {
      contact.lastInteractionAt = new Date();
      await contact.save();
    }

    // 2. Conversation (Scoped to workspace)
    let conversation = await Conversation.findOne({
      workspaceId: req.workspaceId,
      contactId: contact._id,
    });

    if (!conversation) {
      conversation = await Conversation.create({
        workspaceId: req.workspaceId,
        contactId: contact._id,
        unreadCount: 1,
        status: 'open',
        lastMessage: {
          body: cleanText,
          type: 'text',
          direction: 'inbound',
          timestamp: new Date(),
          status: 'delivered',
        },
        lastMessageAt: new Date(),
      });
    } else {
      conversation.unreadCount += 1;
      conversation.status = 'open';
      conversation.lastMessage = {
        body: cleanText,
        type: 'text',
        direction: 'inbound',
        timestamp: new Date(),
        status: 'delivered',
      };
      conversation.lastMessageAt = new Date();
      await conversation.save();
    }

    // 3. Message (Scoped to workspace)
    const message = await Message.create({
      workspaceId: req.workspaceId,
      conversationId: conversation._id,
      contactId: contact._id,
      direction: 'inbound',
      type: 'text',
      body: cleanText,
      status: 'delivered',
      whatsappMessageId: `sim_${Date.now()}`,
    });

    // 4. Socket.IO Broadcast to workspace room
    const io = getSocketIO();
    if (io) {
      io.to(`workspace_${req.workspaceId}`).emit('message:new', {
        conversationId: conversation._id,
        contact,
        message,
      });
      io.to(`workspace_${req.workspaceId}`).emit('conversation:updated', {
        conversation,
      });
    }

    // 5. Trigger Automation Engine
    await AutomationEngine.processIncomingMessage({
      workspaceId: req.workspaceId,
      contact,
      conversation,
      incomingMessage: message,
    });

    return sendSuccess(res, 'Simulated incoming WhatsApp message processed', {
      contact,
      conversation,
      message,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Get Webhook Activity Logs
 * GET /api/whatsapp/webhook-logs
 */
const getWebhookLogs = async (req, res, next) => {
  try {
    const recentMessages = await Message.find({
      workspaceId: req.workspaceId,
    })
      .sort({ createdAt: -1 })
      .limit(20);

    const logs = recentMessages.map((m) => ({
      _id: m._id,
      eventType: m.direction === 'inbound' ? 'messages.received' : `messages.${m.status}`,
      rawPayload: {
        id: m.whatsappMessageId || m._id,
        direction: m.direction,
        type: m.type,
        body: m.body,
        status: m.status,
      },
      createdAt: m.createdAt,
    }));

    return sendSuccess(res, 'Webhook logs retrieved', { logs });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWhatsAppStatus,
  connectWhatsAppAccount,
  sendTestMessage,
  simulateIncomingMessage,
  getWebhookLogs,
};
