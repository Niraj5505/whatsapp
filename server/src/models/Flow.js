const mongoose = require('mongoose');

const flowNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: {
    type: String,
    enum: ['trigger', 'send_message', 'send_buttons', 'send_template', 'add_tag', 'remove_tag', 'condition', 'delay', 'human_handoff'],
    required: true,
  },
  data: {
    label: { type: String, default: '' },
    messageText: { type: String, default: '' },
    templateName: { type: String, default: '' },
    buttons: [{ id: String, text: String }],
    tagName: { type: String, default: '' },
    conditionVariable: { type: String, default: '' },
    conditionValue: { type: String, default: '' },
    delaySeconds: { type: Number, default: 0 },
  },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
  },
});

const flowEdgeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  source: { type: String, required: true },
  target: { type: String, required: true },
  sourceHandle: { type: String, default: null },
});

const flowSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Flow name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    triggerType: {
      type: String,
      enum: ['keyword', 'welcome', 'fallback', 'tag_added', 'manual'],
      default: 'keyword',
    },
    triggerKeywords: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],
    nodes: [flowNodeSchema],
    edges: [flowEdgeSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    executionCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Flow', flowSchema);
