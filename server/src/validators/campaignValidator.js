const { z } = require('zod');

const campaignSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Campaign name is required'),
    messageType: z.enum(['template', 'text']),
    templateName: z.string().optional(),
    templateLanguage: z.string().optional(),
    customMessage: z.string().optional(),
    variables: z.record(z.string()).optional(),
    targetAudience: z.object({
      type: z.enum(['all', 'tags', 'custom_list']),
      tags: z.array(z.string()).optional(),
      contactIds: z.array(z.string()).optional(),
    }),
    scheduledAt: z.string().datetime().optional().nullable(),
  }),
});

module.exports = {
  campaignSchema,
};
