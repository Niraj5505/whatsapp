const { z } = require('zod');

const flowSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Flow name is required'),
    description: z.string().optional(),
    triggerType: z.enum(['keyword', 'welcome', 'fallback', 'tag_added', 'manual']),
    triggerKeywords: z.array(z.string()).optional(),
    nodes: z.array(z.any()).optional(),
    edges: z.array(z.any()).optional(),
    isActive: z.boolean().optional(),
  }),
});

module.exports = {
  flowSchema,
};
