const mongoose = require("mongoose");

const blockHeaderSchema = new mongoose.Schema(
  {
    blockNumber: {
      type: Number,
      required: true,
      unique: true,
      index: true,
    },
    blockHash: {
      type: String,
      required: true,
      index: true,
    },
    parentHash: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Number,
      default: () => Math.floor(Date.now() / 1000),
    },
    status: {
      type: String,
      enum: ["canonical", "orphaned"],
      default: "canonical",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BlockHeader", blockHeaderSchema);
