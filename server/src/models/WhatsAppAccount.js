const mongoose = require('mongoose');

const whatsAppAccountSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    phoneNumberId: {
      type: String,
      required: [true, 'Phone number ID is required'],
      trim: true,
      index: true,
    },
    businessAccountId: {
      type: String,
      trim: true,
      default: '',
    },
    displayName: {
      type: String,
      trim: true,
      default: '',
    },
    accessTokenEncrypted: {
      type: String,
      default: '',
      select: false, // CRITICAL SECURITY: Never select/expose encrypted or raw access tokens in default queries
    },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'pending', 'restricted', 'error'],
      default: 'connected',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

whatsAppAccountSchema.index({ workspaceId: 1, phoneNumberId: 1 });
whatsAppAccountSchema.index({ workspaceId: 1, status: 1 });

module.exports = mongoose.model('WhatsAppAccount', whatsAppAccountSchema);
