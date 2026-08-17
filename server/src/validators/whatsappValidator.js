const { z } = require('zod');

const sendTextMessageSchema = z.object({
  body: z.object({
    to: z.string().min(6, 'Recipient phone number is required'),
    message: z.string().min(1, 'Message text is required'),
    previewUrl: z.boolean().optional(),
  }),
});

const sendTemplateMessageSchema = z.object({
  body: z.object({
    to: z.string().min(6, 'Recipient phone number is required'),
    templateName: z.string().min(1, 'Template name is required'),
    languageCode: z.string().default('en_US'),
    components: z.array(z.any()).optional(),
  }),
});

const sendMediaMessageSchema = z.object({
  body: z.object({
    to: z.string().min(6, 'Recipient phone number is required'),
    mediaType: z.enum(['image', 'document', 'audio', 'video']),
    mediaUrl: z.string().url('Must be a valid URL'),
    caption: z.string().optional(),
    filename: z.string().optional(),
  }),
});

module.exports = {
  sendTextMessageSchema,
  sendTemplateMessageSchema,
  sendMediaMessageSchema,
};
