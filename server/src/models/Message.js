const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      required: [true, 'Contact ID is required'],
      index: true,
    },
    whatsappAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppAccount',
      default: null,
      index: true,
    },
    whatsappMessageId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['inbound', 'outbound'],
      required: [true, 'Message direction is required'],
    },
    type: {
      type: String,
      enum: [
        'text',
        'image',
        'video',
        'audio',
        'document',
        'template',
        'interactive',
        'location',
        'contacts',
        'sticker',
        'reaction',
        'system',
      ],
      default: 'text',
    },
    body: {
      type: String,
      default: '',
    },
    media: {
      url: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      fileName: { type: String, default: '' },
      fileSize: { type: Number, default: 0 },
      caption: { type: String, default: '' },
      id: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'read', 'failed', 'received'],
      default: 'sent',
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    error: {
      code: { type: String, default: '' },
      message: { type: String, default: '' },
      details: { type: mongoose.Schema.Types.Mixed, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Important indexes
messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ workspaceId: 1, createdAt: -1 });
messageSchema.index({ workspaceId: 1, contactId: 1 });

module.exports = mongoose.model('Message', messageSchema);
