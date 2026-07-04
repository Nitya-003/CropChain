const logger = require("../utils/logger");
const Auction = require("../models/Auction");
const User = require("../models/User");
const Batch = require("../models/Batch");
const socketService = require("../services/socketService");
const notificationService = require("../services/notificationService");

const settleExpiredAuctions = async () => {
  try {
    // Find active auctions that have expired
    const expiredAuctions = await Auction.find({
      status: "active",
      endTime: { $lte: new Date() },
    });

    if (expiredAuctions.length === 0) return;

    logger.info(`Found ${expiredAuctions.length} expired auctions to settle`);

    for (const auction of expiredAuctions) {
      auction.status = "ended";
      await auction.save();

      const io = socketService.getIO();

      // If there's a highest bidder, finalize the deal
      if (auction.highestBidder) {
        // 1. Credit the farmer's account
        await User.findByIdAndUpdate(auction.farmerId, {
          $inc: { balance: auction.currentHighestBid },
        });

        // 2. Fetch buyer details
        const buyer = await User.findById(auction.highestBidder);
        const buyerName = buyer ? buyer.name : "Buyer";
        const farmer = await User.findById(auction.farmerId);

        // 3. Update the batch stage to 'mandi' and record history entry
        const batch = await Batch.findById(auction.cropId);
        if (batch) {
          batch.currentStage = "mandi";
          batch.updates.push({
            stage: "mandi",
            actor: buyerName,
            location: "Auction Market",
            notes: `Purchased at live auction for ${auction.currentHighestBid} credits`,
          });
          await batch.save();

          logger.info(
            `Auction settled: Batch ${batch.batchId} sold to ${buyerName} for ${auction.currentHighestBid} credits`,
          );

          // Trigger Socket.io real-time update events for batch stage change
          if (io) {
            io.to(`batch:${batch.batchId}`).emit("batch-updated", batch);
            io.emit("batch-stage-changed", {
              batchId: batch.batchId,
              stage: "mandi",
            });
          }
        }

        // 4. Notify the winner and the farmer about the sale outcome
        const buyerId = auction.highestBidder.toString();
        const farmerId = auction.farmerId.toString();
        const finalPrice = auction.currentHighestBid;

        await notificationService.createInAppNotification(
          buyerId,
          "Auction Won",
          `You won the auction for batch ${auction.batchId} for ${finalPrice} credits.`,
          "auction",
          {
            auctionId: auction._id.toString(),
            batchId: auction.batchId,
            finalPrice,
          },
        );

        await notificationService.createInAppNotification(
          farmerId,
          "Auction Sold",
          `Your auction for batch ${auction.batchId} sold for ${finalPrice} credits.`,
          "auction",
          {
            auctionId: auction._id.toString(),
            batchId: auction.batchId,
            finalPrice,
          },
        );

        if (buyer && buyer.email) {
          await notificationService.sendEmail(
            buyer.email,
            `You won auction ${auction.batchId}`,
            `<h2>Auction Won</h2><p>Congratulations! You won the auction for batch <strong>${auction.batchId}</strong> for <strong>${finalPrice}</strong> credits.</p><p>CropChain Team</p>`,
          );
        }

        if (farmer && farmer.email) {
          await notificationService.sendEmail(
            farmer.email,
            `Auction sold: ${auction.batchId}`,
            `<h2>Auction Sold</h2><p>Your auction for batch <strong>${auction.batchId}</strong> has completed successfully for <strong>${finalPrice}</strong> credits.</p><p>CropChain Team</p>`,
          );
        }
      } else {
        logger.info(
          `Auction ended without any bids for batch ${auction.batchId}`,
        );
      }

      // Emit socket notifications to the room
      if (io) {
        io.to(`auction:${auction._id}`).emit("auction_ended", auction);
      }
    }
  } catch (error) {
    logger.error("Error settling expired auctions:", { error: error.message });
  }
};

const startAuctionSettlementJob = () => {
  logger.info("Starting background auction settlement check job (every 10s)");
  setInterval(settleExpiredAuctions, 10000);
};

module.exports = { startAuctionSettlementJob, settleExpiredAuctions };
