const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
    },
    whatsappAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppAccount',
      default: null,
      index: true,
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MessageTemplate',
      required: [true, 'Approved template is required'],
      index: true,
    },
    targetTags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'PROCESSING', 'COMPLETED', 'PAUSED', 'CANCELLED', 'FAILED', 'draft', 'scheduled', 'processing', 'completed', 'paused', 'cancelled', 'failed'],
      default: 'DRAFT',
      index: true,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    statistics: {
      totalRecipients: { type: Number, default: 0 },
      queued: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      read: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Important compound indexes
campaignSchema.index({ workspaceId: 1, createdAt: -1 });
campaignSchema.index({ workspaceId: 1, status: 1 });
campaignSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model('Campaign', campaignSchema);
