const mongoose = require('mongoose');

const tagSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Tag name is required'],
      trim: true,
    },
    color: {
      type: String,
      default: '#6366F1',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique tag name per workspace
tagSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Tag', tagSchema);
