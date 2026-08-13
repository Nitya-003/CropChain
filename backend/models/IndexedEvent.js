const mongoose = require("mongoose");

const indexedEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    batchId: {
      type: String,
      required: true,
      index: true,
    },
    eventName: {
      type: String,
      required: true,
      index: true,
    },
    blockNumber: {
      type: Number,
      required: true,
      index: true,
    },
    blockHash: {
      type: String,
      required: true,
    },
    transactionHash: {
      type: String,
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["UNFINALIZED", "FINALIZED", "ROLLED_BACK"],
      default: "UNFINALIZED",
      index: true,
    },
    confirmations: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("IndexedEvent", indexedEventSchema);
