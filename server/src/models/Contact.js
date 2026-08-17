const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    name: {
      type: String,
      default: 'WhatsApp User',
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    whatsappId: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
    customFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    notes: {
      type: String,
      default: '',
    },
    optedOut: {
      type: Boolean,
      default: false,
    },
    lastInteractionAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Important indexes
contactSchema.index({ workspaceId: 1, phoneNumber: 1 });
contactSchema.index({ workspaceId: 1, whatsappId: 1 });
contactSchema.index({ workspaceId: 1, lastInteractionAt: -1 });

module.exports = mongoose.model('Contact', contactSchema);
