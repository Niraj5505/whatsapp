const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    eventType: {
      type: String,
      default: 'messages',
    },
    rawPayload: {
      type: Object,
      required: true,
    },
    processed: {
      type: Boolean,
      default: true,
    },
    error: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('WebhookLog', webhookLogSchema);
