const { z } = require('zod');

const sendMessageSchema = z.object({
  phone: z.string().min(7).max(20),
  message: z.string().min(1).max(4096),
  leadId: z.string().uuid().optional()
});

const createLeadSchema = z.object({
  phone: z.string().min(7).max(20),
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  tag: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']).optional()
});

const updateLeadSchema = z.object({
  name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  tag: z.enum(['HOT', 'WARM', 'COLD']).optional(),
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST']).optional(),
  metadata: z.record(z.any()).optional()
});

const createCampaignSchema = z.object({
  name: z.string().min(1).max(100),
  template: z.string().min(1),
  settings: z.record(z.any()).optional(),
  scheduledAt: z.string().datetime().optional()
});

function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: err.errors
      });
    }
  };
}

module.exports = {
  validate,
  sendMessageSchema,
  createLeadSchema,
  updateLeadSchema,
  createCampaignSchema
};