const { z } = require('zod');

const createContactSchema = z.object({
  body: z.object({
    phoneNumber: z.string().min(6, 'Valid phone number is required'),
    name: z.string().optional(),
    email: z.string().email('Invalid email format').optional().or(z.literal('')),
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.any()).optional(),
    notes: z.string().optional(),
    optedOut: z.boolean().optional(),
  }),
});

const updateContactSchema = z.object({
  body: z.object({
    phoneNumber: z.string().min(6).optional(),
    name: z.string().optional(),
    email: z.string().email('Invalid email format').optional().or(z.literal('')),
    tags: z.array(z.string()).optional(),
    customFields: z.record(z.any()).optional(),
    notes: z.string().optional(),
    optedOut: z.boolean().optional(),
  }),
});

module.exports = {
  createContactSchema,
  updateContactSchema,
};
