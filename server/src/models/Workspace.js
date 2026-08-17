const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Workspace name is required'],
      trim: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        timezone: 'UTC',
        currency: 'USD',
        autoReply: false,
        notificationPreferences: {
          email: true,
          inApp: true,
        },
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Workspace', workspaceSchema);
