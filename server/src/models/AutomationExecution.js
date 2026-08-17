const mongoose = require('mongoose');

const automationExecutionSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    automationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Automation',
      required: [true, 'Automation ID is required'],
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
      index: true,
    },
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contact',
      default: null,
      index: true,
    },
    triggerData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    actionsExecuted: [
      {
        nodeId: { type: String },
        actionType: { type: String },
        status: { type: String },
        executedAt: { type: Date, default: Date.now },
        output: { type: mongoose.Schema.Types.Mixed },
        error: { type: String, default: null },
      },
    ],
    error: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Important indexes
automationExecutionSchema.index({ automationId: 1, startedAt: -1 });
automationExecutionSchema.index({ workspaceId: 1, startedAt: -1 });
automationExecutionSchema.index({ workspaceId: 1, status: 1 });

module.exports = mongoose.model('AutomationExecution', automationExecutionSchema);
