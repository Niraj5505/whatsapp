const mongoose = require('mongoose');

const templateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    metaTemplateId: {
      type: String,
      default: '',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION'],
      default: 'UTILITY',
    },
    language: {
      type: String,
      default: 'en_US',
    },
    status: {
      type: String,
      enum: ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED'],
      default: 'APPROVED',
    },
    components: [
      {
        type: {
          type: String,
          enum: ['HEADER', 'BODY', 'FOOTER', 'BUTTONS'],
        },
        format: {
          type: String,
          enum: ['TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO'],
          default: 'TEXT',
        },
        text: { type: String, default: '' },
        buttons: [
          {
            type: { type: String, enum: ['QUICK_REPLY', 'URL', 'PHONE_NUMBER'] },
            text: { type: String },
            url: { type: String },
            phoneNumber: { type: String },
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

templateSchema.index({ userId: 1, name: 1, language: 1 }, { unique: true });

module.exports = mongoose.model('Template', templateSchema);
