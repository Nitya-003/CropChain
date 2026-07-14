const mongoose = require("mongoose");
const logger = require("../utils/logger");
const Auction = require("../models/Auction");
const User = require("../models/User");
const Batch = require("../models/Batch");
const socketService = require("../services/socketService");
const notificationService = require("../services/notificationService");

class AuctionSettlementError extends Error {
  constructor(message, auctionId, cause) {
    super(message);
    this.name = "AuctionSettlementError";
    this.auctionId = auctionId;
    this.cause = cause;
  }
}

const claimAndSettleNextAuction = async (now, excludedAuctionIds = []) => {
  const session = await mongoose.startSession();
  let claimedAuction = null;
  let settlementResult = null;

  try {
    await session.withTransaction(async () => {
      claimedAuction = null;
      settlementResult = null;
      const claimFilter = {
        status: "active",
        endTime: { $lte: now },
        settledAt: null,
      };
      if (excludedAuctionIds.length > 0) {
        claimFilter._id = { $nin: excludedAuctionIds };
      }

      claimedAuction = await Auction.findOneAndUpdate(
        claimFilter,
        {
          $set: {
            status: "ended",
            settledAt: now,
          },
        },
        {
          new: true,
          session,
          sort: { endTime: 1 },
        },
      );

      if (!claimedAuction) return null;

      let buyer = null;
      let farmer = null;
      let batch = null;

      if (claimedAuction.highestBidder) {
        buyer = await User.findById(claimedAuction.highestBidder, null, { session });
        farmer = await User.findOneAndUpdate(
          { _id: claimedAuction.farmerId },
          { $inc: { balance: claimedAuction.currentHighestBid } },
          { new: true, session },
        );
        if (!farmer) {
          throw new Error("Auction farmer not found");
        }

        const buyerName = buyer ? buyer.name : "Buyer";
        batch = await Batch.findOneAndUpdate(
          { _id: claimedAuction.cropId },
          {
            $set: { currentStage: "mandi" },
            $push: {
              updates: {
                stage: "mandi",
                actor: buyerName,
                location: "Auction Market",
                notes: `Purchased at live auction for ${claimedAuction.currentHighestBid} credits`,
              },
            },
          },
          { new: true, session },
        );
        if (!batch) {
          throw new Error("Auction batch not found");
        }
      }

      settlementResult = { auction: claimedAuction, buyer, farmer, batch };
    });
    return settlementResult;
  } catch (error) {
    throw new AuctionSettlementError(
      error.message,
      claimedAuction ? claimedAuction._id.toString() : null,
      error,
    );
  } finally {
    await session.endSession();
  }
};
const runSideEffect = async (description, action) => {
  try {
    await action();
  } catch (error) {
    logger.error(`Auction settlement side effect failed (${description}):`, {
      error: error.message,
    });
  }
};

const emitSettlementSideEffects = async ({ auction, buyer, farmer, batch }) => {
  let io = null;
  try {
    io = socketService.getIO();
  } catch (error) {
    logger.error("Auction settlement side effect failed (socket lookup):", {
      error: error.message,
    });
  }

  if (!auction.highestBidder) {
    logger.info(`Auction ended without any bids for batch ${auction.batchId}`);
  } else {
    const buyerId = auction.highestBidder.toString();
    const farmerId = auction.farmerId.toString();
    const finalPrice = auction.currentHighestBid;
    const buyerName = buyer ? buyer.name : "Buyer";

    logger.info(
      `Auction settled: Batch ${batch.batchId} sold to ${buyerName} for ${finalPrice} credits`,
    );

    if (io) {
      await runSideEffect("batch socket events", async () => {
        io.to(`batch:${batch.batchId}`).emit("batch-updated", batch);
        io.emit("batch-stage-changed", {
          batchId: batch.batchId,
          stage: "mandi",
        });
      });
    }

    await runSideEffect("winner notification", () =>
      notificationService.createInAppNotification(
        buyerId,
        "Auction Won",
        `You won the auction for batch ${auction.batchId} for ${finalPrice} credits.`,
        "auction",
        {
          auctionId: auction._id.toString(),
          batchId: auction.batchId,
          finalPrice,
        },
      ),
    );

    await runSideEffect("farmer notification", () =>
      notificationService.createInAppNotification(
        farmerId,
        "Auction Sold",
        `Your auction for batch ${auction.batchId} sold for ${finalPrice} credits.`,
        "auction",
        {
          auctionId: auction._id.toString(),
          batchId: auction.batchId,
          finalPrice,
        },
      ),
    );

    if (buyer && buyer.email) {
      await runSideEffect("winner email", () =>
        notificationService.sendEmail(
          buyer.email,
          `You won auction ${auction.batchId}`,
          `<h2>Auction Won</h2><p>Congratulations! You won the auction for batch <strong>${auction.batchId}</strong> for <strong>${finalPrice}</strong> credits.</p><p>CropChain Team</p>`,
        ),
      );
    }

    if (farmer && farmer.email) {
      await runSideEffect("farmer email", () =>
        notificationService.sendEmail(
          farmer.email,
          `Auction sold: ${auction.batchId}`,
          `<h2>Auction Sold</h2><p>Your auction for batch <strong>${auction.batchId}</strong> has completed successfully for <strong>${finalPrice}</strong> credits.</p><p>CropChain Team</p>`,
        ),
      );
    }
  }

  if (io) {
    await runSideEffect("auction ended socket event", async () => {
      io.to(`auction:${auction._id}`).emit("auction_ended", auction);
    });
  }
};

const settleExpiredAuctions = async () => {
  const attemptedAuctionIds = [];

  while (true) {
    try {
      const result = await claimAndSettleNextAuction(
        new Date(),
        attemptedAuctionIds,
      );
      if (!result) return;

      attemptedAuctionIds.push(result.auction._id.toString());
      await emitSettlementSideEffects(result);
    } catch (error) {
      logger.error("Error settling expired auction:", {
        auctionId: error.auctionId,
        error: error.message,
      });

      if (!error.auctionId) return;
      attemptedAuctionIds.push(error.auctionId);
    }
  }
};

const startAuctionSettlementJob = () => {
  logger.info("Starting background auction settlement check job (every 10s)");
  setInterval(settleExpiredAuctions, 10000);
};

module.exports = {
  startAuctionSettlementJob,
  settleExpiredAuctions,
  claimAndSettleNextAuction,
  emitSettlementSideEffects,
};
