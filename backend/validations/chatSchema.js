const Joi = require("joi");

const chatSchema = Joi.object({

  message: Joi.string().min(1).max(1000).required().messages({
    "string.empty": "Message cannot be empty",
    "string.max": "Message is too long (max 1000 characters)",
  }),

  // Optional context like batchId or userRole 🔗
  context: Joi.object({
    currentPage: Joi.string().optional(),
    batchId: Joi.string().optional(),
    userRole: Joi.string().optional(),
  }).optional(),
});

module.exports = { chatSchema };
