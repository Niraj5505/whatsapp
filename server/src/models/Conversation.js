const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    whatsappAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppAccount',
      default: null,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: [true, 'Contact ID is required'],
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'pending', 'resolved', 'closed', 'bot'],
      default: 'open',
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    lastMessage: {
      body: { type: String, default: '' },
      type: {
        type: String,
        enum: ['text', 'image', 'video', 'audio', 'document', 'interactive', 'template', 'location', 'contacts', 'sticker', 'system', 'other'],
        default: 'text',
      },
      direction: {
        type: String,
        enum: ['inbound', 'outbound'],
      },
      status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'read', 'failed', 'received'],
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Important indexes
conversationSchema.index({ workspaceId: 1, lastMessageAt: -1 });
conversationSchema.index({ workspaceId: 1, contactId: 1 });
conversationSchema.index({ workspaceId: 1, status: 1 });
conversationSchema.index({ workspaceId: 1, assignedTo: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
