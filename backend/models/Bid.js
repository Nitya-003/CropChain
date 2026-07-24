const mongoose = require("mongoose");

const bidSchema = new mongoose.Schema(
  {
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    cropId: {
      type: String,
      required: true,
    },
    bidAmount: {
      type: Number,
      required: true,
      min: [0, "Bid amount cannot be negative"],
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Bid", bidSchema);
