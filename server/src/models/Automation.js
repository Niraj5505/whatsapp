const mongoose = require('mongoose');

const automationSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Automation name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    trigger: {
      type: {
        type: String,
        required: [true, 'Trigger type is required'],
        trim: true,
      },
      config: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
    nodes: [
      {
        type: mongoose.Schema.Types.Mixed,
      },
    ],
    edges: [
      {
        type: mongoose.Schema.Types.Mixed,
      },
    ],
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

automationSchema.index({ workspaceId: 1, enabled: 1 });
automationSchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.model('Automation', automationSchema);
