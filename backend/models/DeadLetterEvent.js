const mongoose = require("mongoose");

const deadLetterEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    batchId: {
      type: String,
      index: true,
    },
    blockNumber: {
      type: Number,
    },
    rawPayload: {
      type: mongoose.Schema.Types.Mixed,
    },
    errorReason: {
      type: String,
      required: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSED", "FAILED"],
      default: "PENDING",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeadLetterEvent", deadLetterEventSchema);
