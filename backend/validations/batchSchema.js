const { z } = require('zod');
const { STAGES } = require('../constants/stages');

const createBatchSchema = z.object({
  farmerId: z.string().min(5).max(50).regex(/^[a-zA-Z0-9]+$/).optional(),
  farmerName: z.string()
    .min(2)
    .max(100)
    .regex(/^[a-zA-Z\s.-]+$/, "Farmer name can only contain letters, spaces, periods, and hyphens"),
  farmerAddress: z.string().min(10).max(500),
  cropType: z.enum(["rice", "wheat", "corn", "tomato"]),
  quantity: z.number().min(1).max(1000000),
  harvestDate: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid date format").refine((date) => new Date(date) <= new Date(), "Harvest date cannot be in the future"),
  origin: z.string().min(5).max(200),
  certifications: z.string().max(500).optional(),
  description: z.string().max(1000).optional(),
  blockchainHash: z.string().optional(),
});

const updateBatchSchema = z.object({
  batchId: z.string().optional(),
  stage: z.string()
    .toLowerCase()
    .refine((val) => STAGES.includes(val), {
      message: `Stage must be one of: ${STAGES.join(', ')}`,
    }),
  actor: z.string().min(2).max(100),
  location: z.string().min(2).max(200),
  notes: z.string().max(500).optional(),
  timestamp: z.string().optional().default(() => new Date().toISOString())
    .refine((date) => !isNaN(Date.parse(date)), "Invalid date format")
    .refine((date) => new Date(date) <= new Date(), "Timestamp cannot be in the future"),
  blockchainHash: z.string().optional(),
});

const updateBatchStatusSchema = z.object({
  status: z.enum(['Active', 'Flagged', 'Inactive']),
});

const recordIoTDataSchema = z.object({
  temperature: z.number().min(-20).max(140),
  humidity: z.number().min(0).max(100),
});

module.exports = { 
  createBatchSchema, 
  updateBatchSchema,
  updateBatchStatusSchema,
  recordIoTDataSchema
};
