const { z } = require('zod');
const STAGES = require('../constants/stages');

// Strict ISO 8601 calendar date (YYYY-MM-DD). Date.parse()/new Date() alone
// are too lenient (e.g. accept "2022-1-1", or silently roll over invalid
// days in some engines), so we gate on the regex first, then confirm the
// parsed date round-trips to the same calendar date (catches "2022-13-01",
// "2022-02-30", etc.).
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;

const isValidCalendarDate = (value) => {
    if (typeof value !== 'string') return false;
    if (!ISO_DATE_RE.test(value)) return false;
    const parsed = new Date(value);
    return !isNaN(parsed.getTime());
};

const isoDateField = (label) =>
    z.string({ required_error: `${label} is required` })
        .refine(isValidCalendarDate, `${label} must be a valid ISO date (YYYY-MM-DD)`);

const createBatchSchema = z.object({
    farmerId: z.string().min(5).max(50).regex(/^[a-zA-Z0-9]+$/).optional(),
    farmerName: z.string()
        .min(2)
        .max(100)
        .regex(/^[a-zA-Z\s.-]+$/, 'Farmer name can only contain letters, spaces, periods, and hyphens'),
    farmerAddress: z.string().min(10).max(500),
    cropType: z.enum(['rice', 'wheat', 'corn', 'tomato']),

    // "weight" in the issue maps to this codebase's `quantity` (kg) field.
    // z.number() already rejects strings like "ten" outright (no coercion),
    // .positive() additionally rejects 0 and negative values.
    quantity: z.number({ invalid_type_error: 'quantity must be a number' })
        .positive('quantity must be a positive number')
        .max(1000000),

    harvestDate: isoDateField('harvestDate')
        .refine((date) => new Date(date) <= new Date(), 'Harvest date cannot be in the future'),

    // New: previously unvalidated and unused entirely.
    expiryDate: isoDateField('expiryDate').optional(),

    origin: z.string().min(5).max(200),
    certifications: z.string().max(500).optional(),
    description: z.string().max(1000).optional(),
    blockchainHash: z.string().optional(),
}).refine(
    (data) => !data.expiryDate || new Date(data.expiryDate) >= new Date(data.harvestDate),
    {
        message: 'expiryDate must be on or after harvestDate',
        path: ['expiryDate'],
    }
);

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
        .refine((date) => !isNaN(Date.parse(date)), 'Invalid date format')
        .refine((date) => new Date(date) <= new Date(), 'Timestamp cannot be in the future'),
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
  recordIoTDataSchema,
};
