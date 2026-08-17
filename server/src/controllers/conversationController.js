const mongoose = require('mongoose');
const { Conversation, Message, Contact, WhatsAppAccount } = require('../models');
const WhatsAppService = require('../services/whatsappService');
const { getSocketIO } = require('../sockets/socketServer');
const { sendSuccess, sendError } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * 1. Get all conversations in workspace with search, status filter, and pagination
 * GET /api/conversations
 */
const getConversations = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const query = { workspaceId: req.workspaceId };

    if (status && status !== 'all') {
      query.status = status;
    }

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const skip = (parsedPage - 1) * parsedLimit;

    // If search is applied, we can find matching contacts first
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const matchingContacts = await Contact.find({
        workspaceId: req.workspaceId,
        $or: [{ name: searchRegex }, { phoneNumber: searchRegex }, { email: searchRegex }],
      }).select('_id');

      const contactIds = matchingContacts.map((c) => c._id);
      query.$or = [
        { contactId: { $in: contactIds } },
        { 'lastMessage.body': searchRegex },
      ];
    }

    const [total, conversations] = await Promise.all([
      Conversation.countDocuments(query),
      Conversation.find(query)
        .populate({
          path: 'contactId',
          populate: { path: 'tags' },
        })
        .populate('assignedTo', 'name email role')
        .sort({ lastMessageAt: -1, updatedAt: -1 })
        .skip(skip)
        .limit(parsedLimit),
    ]);

    return sendSuccess(res, 'Conversations retrieved', {
      conversations,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. Get Single Conversation details
 * GET /api/conversations/:id
 */
const getConversationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid conversation ID format', 400);
    }

    const conversation = await Conversation.findOne({
      _id: id,
      workspaceId: req.workspaceId,
    })
      .populate({
        path: 'contactId',
        populate: { path: 'tags' },
      })
      .populate('whatsappAccountId')
      .populate('assignedTo', 'name email role');

    if (!conversation) {
      return sendError(res, 'Conversation not found in this workspace', 404);
    }

    return sendSuccess(res, 'Conversation retrieved', { conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. Get messages of a specific conversation with pagination (conversationId + createdAt index)
 * GET /api/conversations/:id/messages
 */
const getMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 50, page = 1, before } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid conversation ID format', 400);
    }

    const conversation = await Conversation.findOne({
      _id: id,
      workspaceId: req.workspaceId,
    }).populate({
      path: 'contactId',
      populate: { path: 'tags' },
    });

    if (!conversation) {
      return sendError(res, 'Conversation not found in this workspace', 404);
    }

    const parsedLimit = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);

    const messageQuery = {
      conversationId: conversation._id,
      workspaceId: req.workspaceId,
    };

    if (before) {
      messageQuery.createdAt = { $lt: new Date(before) };
    }

    const skip = before ? 0 : (parsedPage - 1) * parsedLimit;

    const [total, messages] = await Promise.all([
      Message.countDocuments({
        conversationId: conversation._id,
        workspaceId: req.workspaceId,
      }),
      Message.find(messageQuery)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(parsedLimit),
    ]);

    // Automatically mark unread count as 0 if opening conversation
    if (conversation.unreadCount > 0) {
      conversation.unreadCount = 0;
      await conversation.save();

      const io = getSocketIO();
      if (io) {
        io.to(`workspace_${req.workspaceId}`).emit('conversation:read', {
          conversationId: conversation._id,
        });
        io.to(`workspace_${req.workspaceId}`).emit('conversation:updated', {
          conversation,
        });
      }
    }

    return sendSuccess(res, 'Messages retrieved', {
      conversation,
      messages,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. Send outbound message in conversation
 * POST /api/conversations/:id/messages
 */
const sendMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      content,
      body,
      text,
      type = 'text',
      messageType,
      mediaUrl = '',
      mediaCaption = '',
      caption = '',
      filename = '',
      templateName = '',
      languageCode = 'en_US',
      components = [],
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid conversation ID format', 400);
    }

    const conversation = await Conversation.findOne({
      _id: id,
      workspaceId: req.workspaceId,
    }).populate('contactId');

    if (!conversation) {
      return sendError(res, 'Conversation not found in this workspace', 404);
    }

    const contact = conversation.contactId;
    if (!contact) {
      return sendError(res, 'Contact associated with conversation not found', 404);
    }

    const msgType = (messageType || type || 'text').toLowerCase();
    const msgText = text || body || content || '';
    const finalCaption = caption || mediaCaption || msgText;

    // Resolve WhatsAppAccount credentials
    let account = null;
    if (conversation.whatsappAccountId) {
      account = await WhatsAppAccount.findById(conversation.whatsappAccountId);
    }
    if (!account) {
      account = await WhatsAppAccount.findOne({
        workspaceId: req.workspaceId,
        status: { $ne: 'disconnected' },
      });
    }

    const phoneNumberId = account?.phoneNumberId || process.env.META_PHONE_NUMBER_ID;
    const accessToken = account?.accessTokenEncrypted || process.env.META_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      return sendError(res, 'Meta WhatsApp Cloud API credentials are not configured for this workspace', 400);
    }

    let metaRes = null;
    let deliveryStatus = 'sent';
    let whatsappMessageId = `wamid.out.${Date.now()}.${Math.random().toString(36).substring(7)}`;

    // Call Real Meta Cloud API
    try {
      if (msgType === 'text') {
        metaRes = await WhatsAppService.sendTextMessage({
          to: contact.phoneNumber,
          text: msgText,
          phoneNumberId,
          accessToken,
        });
      } else if (msgType === 'image') {
        metaRes = await WhatsAppService.sendImageMessage({
          to: contact.phoneNumber,
          imageUrl: mediaUrl,
          caption: finalCaption,
          phoneNumberId,
          accessToken,
        });
      } else if (msgType === 'document') {
        metaRes = await WhatsAppService.sendDocumentMessage({
          to: contact.phoneNumber,
          documentUrl: mediaUrl,
          filename,
          caption: finalCaption,
          phoneNumberId,
          accessToken,
        });
      } else if (msgType === 'audio') {
        metaRes = await WhatsAppService.sendAudioMessage({
          to: contact.phoneNumber,
          audioUrl: mediaUrl,
          phoneNumberId,
          accessToken,
        });
      } else if (msgType === 'video') {
        metaRes = await WhatsAppService.sendVideoMessage({
          to: contact.phoneNumber,
          videoUrl: mediaUrl,
          caption: finalCaption,
          phoneNumberId,
          accessToken,
        });
      } else if (msgType === 'template') {
        metaRes = await WhatsAppService.sendTemplateMessage({
          to: contact.phoneNumber,
          templateName,
          languageCode,
          components,
          phoneNumberId,
          accessToken,
        });
      }

      if (metaRes?.messages?.[0]?.id) {
        whatsappMessageId = metaRes.messages[0].id;
      }
    } catch (apiErr) {
      logger.error(`[Conversation Send Error] ${apiErr.message}`);
      return sendError(res, apiErr.message, apiErr.status || 400, apiErr.metaDetails || null);
    }

    // Store Message in MongoDB
    const createdMessage = await Message.create({
      workspaceId: req.workspaceId,
      conversationId: conversation._id,
      contactId: contact._id,
      whatsappAccountId: account?._id || null,
      whatsappMessageId,
      direction: 'outbound',
      type: msgType,
      body: msgText || finalCaption || `[${msgType.toUpperCase()}]`,
      media: {
        url: mediaUrl || '',
        fileName: filename || '',
        caption: finalCaption || '',
      },
      status: deliveryStatus,
      metadata: metaRes || {},
    });

    // Update Conversation
    conversation.lastMessage = {
      body: createdMessage.body,
      type: msgType,
      direction: 'outbound',
      status: deliveryStatus,
      timestamp: new Date(),
    };
    conversation.lastMessageAt = new Date();
    conversation.status = 'open';
    await conversation.save();

    // Update Contact last interaction
    contact.lastInteractionAt = new Date();
    await contact.save();

    // Emit Socket.IO Events
    const io = getSocketIO();
    if (io) {
      io.to(`workspace_${req.workspaceId}`).emit('message:new', {
        conversationId: conversation._id,
        message: createdMessage,
      });

      io.to(`workspace_${req.workspaceId}`).emit('conversation:updated', {
        conversation,
      });
    }

    return sendSuccess(
      res,
      'Message sent successfully',
      {
        message: createdMessage,
        conversation,
      },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * 5. Mark conversation as read
 * PATCH /api/conversations/:id/read
 */
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid conversation ID format', 400);
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, workspaceId: req.workspaceId },
      { $set: { unreadCount: 0 } },
      { new: true }
    ).populate('contactId');

    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    const io = getSocketIO();
    if (io) {
      io.to(`workspace_${req.workspaceId}`).emit('conversation:read', {
        conversationId: conversation._id,
      });
      io.to(`workspace_${req.workspaceId}`).emit('conversation:updated', {
        conversation,
      });
    }

    return sendSuccess(res, 'Conversation marked as read', { conversation });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. Update conversation status (open, pending, resolved, closed, bot)
 * PATCH /api/conversations/:id/status
 */
const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, assignedTo } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'Invalid conversation ID format', 400);
    }

    const updateFields = {};
    if (status) {
      const allowed = ['open', 'pending', 'resolved', 'closed', 'bot'];
      if (!allowed.includes(status)) {
        return sendError(res, `Invalid status. Allowed values: ${allowed.join(', ')}`, 400);
      }
      updateFields.status = status;
    }

    if (assignedTo !== undefined) {
      updateFields.assignedTo = assignedTo || null;
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: id, workspaceId: req.workspaceId },
      { $set: updateFields },
      { new: true }
    ).populate('contactId');

    if (!conversation) {
      return sendError(res, 'Conversation not found', 404);
    }

    const io = getSocketIO();
    if (io) {
      io.to(`workspace_${req.workspaceId}`).emit('conversation:updated', {
        conversation,
      });
    }

    return sendSuccess(res, 'Conversation status updated', { conversation });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  getConversationById,
  getMessages,
  sendMessage,
  markAsRead,
  updateStatus,
};
