const mongoose = require('mongoose');

const messageTemplateSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      lowercase: true,
    },
    metaTemplateId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
      default: 'MARKETING',
      index: true,
    },
    language: {
      type: String,
      default: 'en_US',
      trim: true,
    },
    header: {
      type: {
        type: String,
        enum: ['TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO', 'LOCATION', 'NONE'],
        default: 'NONE',
      },
      text: { type: String, default: '' },
      mediaUrl: { type: String, default: '' },
      example: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    body: {
      type: String,
      required: [true, 'Template body is required'],
      trim: true,
    },
    footer: {
      type: String,
      default: '',
      trim: true,
    },
    buttons: [
      {
        type: {
          type: String,
          enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'],
          default: 'QUICK_REPLY',
        },
        text: { type: String, required: true },
        url: { type: String, default: '' },
        phoneNumber: { type: String, default: '' },
        example: [String],
      },
    ],
    variables: {
      type: [String],
      default: [],
    },
    components: [
      {
        type: mongoose.Schema.Types.Mixed,
      },
    ],
    status: {
      type: String,
      enum: ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED'],
      default: 'PENDING',
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

messageTemplateSchema.index({ workspaceId: 1, name: 1, language: 1 }, { unique: true });
messageTemplateSchema.index({ workspaceId: 1, status: 1 });
messageTemplateSchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.model('MessageTemplate', messageTemplateSchema);
