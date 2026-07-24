const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Batch = require('../models/Batch');
const User = require('../models/User');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const socketService = require('../services/socketService');
const mongoose = require('mongoose');
const { toDecimal, fromDecimal, gte, gt, lt, lte, fromString, toNumber } = require('../utils/decimalHelpers');

function convertDecimal128(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  for (const key of Object.keys(obj)) {
    if (obj[key] && typeof obj[key] === 'object' && obj[key]._bsontype === 'Decimal128') {
      obj[key] = parseFloat(obj[key].toString());
    }
  }
  return obj;
}

// Create a new auction for a batch
const createAuction = async (req, res) => {
    try {
        const { batchId, startPrice, duration } = req.body;

        if (!batchId || !startPrice || !duration) {
            return res.status(400).json(
                apiResponse.errorResponse('batchId, startPrice, and duration are required', 'MISSING_FIELDS', 400)
            );
        }

        if (startPrice <= 0 || duration <= 0) {
            return res.status(400).json(
                apiResponse.errorResponse('Price and duration must be positive values', 'INVALID_VALUES', 400)
            );
        }

        // Find the batch
        const batch = await Batch.findOne({ batchId });
        if (!batch) {
            return res.status(404).json(
                apiResponse.notFoundResponse('Batch', batchId)
            );
        }

        // Check ownership: req.user.id must match batch.farmerId, or must be admin
        if (batch.farmerId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json(
                apiResponse.errorResponse('You can only start auctions for batches you own', 'FORBIDDEN', 403)
            );
        }

        // Check if batch is already sold or passed the farmer stage
        if (batch.currentStage !== 'farmer') {
            return res.status(400).json(
                apiResponse.errorResponse('Auctions can only be started for crops in the Farmer stage', 'INVALID_STAGE', 400)
            );
        }

        // Check if an active/pending auction already exists for this batch
        const existingAuction = await Auction.findOne({
            batchId,
            status: 'active',
            endTime: { $gt: new Date() }
        });

        if (existingAuction) {
            return res.status(400).json(
                apiResponse.errorResponse('An active auction already exists for this batch', 'ACTIVE_AUCTION_EXISTS', 400)
            );
        }

        // Calculate end time (duration is in minutes)
        const startTime = new Date();
        const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

        const decimalStartPrice = fromString(String(startPrice));

        const auction = new Auction({
            cropId: batch._id,
            batchId: batch.batchId,
            farmerId: req.user.id,
            startPrice: decimalStartPrice,
            currentHighestBid: decimalStartPrice,
            startTime,
            endTime,
            status: 'active'
        });

        await auction.save();

        logger.info('Auction created successfully', { auctionId: auction._id, batchId, farmerId: req.user.id });

        // Broadcast global auction creation event
        const io = socketService.getIO();
        if (io) {
            io.emit('auction_created', {
                auctionId: auction._id,
                batchId: auction.batchId,
                cropType: batch.cropType,
                quantity: batch.quantity,
                farmerName: batch.farmerName,
                origin: batch.origin,
                startPrice: toNumber(auction.startPrice),
                endTime: auction.endTime
            });
        }

        return res.status(201).json(
            apiResponse.successResponse({ auction }, 'Auction created successfully', 201)
const Auction = require("../models/Auction");
const Bid = require("../models/Bid");
const Batch = require("../models/Batch");
const User = require("../models/User");
const apiResponse = require("../utils/apiResponse");
const logger = require("../utils/logger");
const socketService = require("../services/socketService");
const mongoose = require("mongoose");

// Create a new auction for a batch
const createAuction = async (req, res) => {
  try {
    const { batchId, startPrice, duration } = req.body;

    if (!batchId || !startPrice || !duration) {
      return res
        .status(400)
        .json(
          apiResponse.errorResponse(
            "batchId, startPrice, and duration are required",
            "MISSING_FIELDS",
            400,
          ),
        );
    }

    if (startPrice <= 0 || duration <= 0) {
      return res
        .status(400)
        .json(
          apiResponse.errorResponse(
            "Price and duration must be positive values",
            "INVALID_VALUES",
            400,
          ),
        );
    }

    // Find the batch
    const batch = await Batch.findOne({ batchId });
    if (!batch) {
      return res
        .status(404)
        .json(apiResponse.notFoundResponse("Batch", batchId));
    }

    // Check ownership: req.user.id must match batch.farmerId, or must be admin
    if (batch.farmerId !== req.user.id && req.user.role !== "admin") {
      return res
        .status(403)
        .json(
          apiResponse.errorResponse(
            "You can only start auctions for batches you own",
            "FORBIDDEN",
            403,
          ),
        );
    }

    // Check if batch is already sold or passed the farmer stage
    if (batch.currentStage !== "farmer") {
      return res
        .status(400)
        .json(
          apiResponse.errorResponse(
            "Auctions can only be started for crops in the Farmer stage",
            "INVALID_STAGE",
            400,
          ),
        );
    }

    // Check if an active/pending auction already exists for this batch
    const existingAuction = await Auction.findOne({
      batchId,
      status: "active",
      endTime: { $gt: new Date() },
    });

    if (existingAuction) {
      return res
        .status(400)
        .json(
          apiResponse.errorResponse(
            "An active auction already exists for this batch",
            "ACTIVE_AUCTION_EXISTS",
            400,
          ),
        );
    }

    // Calculate end time (duration is in minutes)
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const auction = new Auction({
      cropId: batch._id,
      batchId: batch.batchId,
      farmerId: req.user.id,
      startPrice,
      currentHighestBid: startPrice,
      startTime,
      endTime,
      status: "active",
    });

    await auction.save();

    logger.info("Auction created successfully", {
      auctionId: auction._id,
      batchId,
      farmerId: req.user.id,
    });

    // Broadcast global auction creation event
    const io = socketService.getIO();
    if (io) {
      io.emit("auction_created", {
        auctionId: auction._id,
        batchId: auction.batchId,
        cropType: batch.cropType,
        quantity: batch.quantity,
        farmerName: batch.farmerName,
        origin: batch.origin,
        startPrice: auction.startPrice,
        endTime: auction.endTime,
      });
    }

    return res
      .status(201)
      .json(
        apiResponse.successResponse(
          { auction },
          "Auction created successfully",
          201,
        ),
      );
  } catch (error) {
    logger.error("Error creating auction", { error: error.message });
    return res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Server error while creating auction",
          "SERVER_ERROR",
          500,
        ),
      );
  }
};

// Get all auctions with populated crop details
const getAllAuctions = async (req, res) => {
    try {
        const { status } = req.query;
        const query = {};

        if (status) {
            query.status = status;
        }

        const auctions = await Auction.find(query)
            .sort({ createdAt: -1 })
            .lean();

        // Populate batches and users details manually to avoid rigid ref dependencies if objects are deleted
        const populatedAuctions = [];
        for (const auction of auctions) {
            convertDecimal128(auction);
            const batch = await Batch.findById(auction.cropId).select('cropType quantity farmerName origin').lean();
            const farmer = await User.findById(auction.farmerId).select('name').lean();
            const bidder = auction.highestBidder 
                ? await User.findById(auction.highestBidder).select('name').lean() 
                : null;

            populatedAuctions.push({
                ...auction,
                batchDetails: batch || null,
                farmerName: farmer ? farmer.name : 'Unknown Farmer',
                highestBidderName: bidder ? bidder.name : null
            });
        }

        return res.json(
            apiResponse.successResponse({ auctions: populatedAuctions }, 'Auctions retrieved successfully')
        );
    } catch (error) {
        logger.error('Error retrieving auctions', { error: error.message });
        return res.status(500).json(
            apiResponse.errorResponse('Server error while retrieving auctions', 'SERVER_ERROR', 500)
        );
  try {
    const { status } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    const auctions = await Auction.find(query).sort({ createdAt: -1 }).lean();

    // Populate batches and users details manually to avoid rigid ref dependencies if objects are deleted
    const populatedAuctions = [];
    for (const auction of auctions) {
      const batch = await Batch.findById(auction.cropId)
        .select("cropType quantity farmerName origin")
        .lean();
      const farmer = await User.findById(auction.farmerId)
        .select("name")
        .lean();
      const bidder = auction.highestBidder
        ? await User.findById(auction.highestBidder).select("name").lean()
        : null;

      populatedAuctions.push({
        ...auction,
        batchDetails: batch || null,
        farmerName: farmer ? farmer.name : "Unknown Farmer",
        highestBidderName: bidder ? bidder.name : null,
      });
    }

    return res.json(
      apiResponse.successResponse(
        { auctions: populatedAuctions },
        "Auctions retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error retrieving auctions", { error: error.message });
    return res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Server error while retrieving auctions",
          "SERVER_ERROR",
          500,
        ),
      );
  }
};

// Get detailed information for a single auction
const getAuctionDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const auction = await Auction.findById(id).lean();
        convertDecimal128(auction);

        if (!auction) {
            return res.status(404).json(
                apiResponse.notFoundResponse('Auction', id)
            );
        }

        const batch = await Batch.findById(auction.cropId).lean();
        const farmer = await User.findById(auction.farmerId).select('name').lean();
        const bidder = auction.highestBidder 
            ? await User.findById(auction.highestBidder).select('name').lean() 
            : null;

        const auctionDetails = {
            ...auction,
            batchDetails: batch || null,
            farmerName: farmer ? farmer.name : 'Unknown Farmer',
            highestBidderName: bidder ? bidder.name : null
        };

        return res.json(
            apiResponse.successResponse({ auction: auctionDetails }, 'Auction details retrieved successfully')
        );
    } catch (error) {
        logger.error('Error retrieving auction details', { error: error.message });
        return res.status(500).json(
            apiResponse.errorResponse('Server error while retrieving auction details', 'SERVER_ERROR', 500)
        );
  try {
    const { id } = req.params;
    const auction = await Auction.findById(id).lean();

    if (!auction) {
      return res.status(404).json(apiResponse.notFoundResponse("Auction", id));
    }

    const batch = await Batch.findById(auction.cropId).lean();
    const farmer = await User.findById(auction.farmerId).select("name").lean();
    const bidder = auction.highestBidder
      ? await User.findById(auction.highestBidder).select("name").lean()
      : null;

    const auctionDetails = {
      ...auction,
      batchDetails: batch || null,
      farmerName: farmer ? farmer.name : "Unknown Farmer",
      highestBidderName: bidder ? bidder.name : null,
    };

    return res.json(
      apiResponse.successResponse(
        { auction: auctionDetails },
        "Auction details retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error retrieving auction details", { error: error.message });
    return res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Server error while retrieving auction details",
          "SERVER_ERROR",
          500,
        ),
      );
  }
};

// Get bidding history for a single auction
const getAuctionBids = async (req, res) => {
    try {
        const { id } = req.params;
        const bids = await Bid.find({ auctionId: id })
            .sort({ timestamp: -1 })
            .lean();
        bids.forEach(convertDecimal128);

        return res.json(
            apiResponse.successResponse({ bids }, 'Bids retrieved successfully')
        );
    } catch (error) {
        logger.error('Error retrieving auction bids', { error: error.message });
        return res.status(500).json(
            apiResponse.errorResponse('Server error while retrieving bids', 'SERVER_ERROR', 500)
        );
    }
  try {
    const { id } = req.params;
    const bids = await Bid.find({ auctionId: id })
      .sort({ timestamp: -1 })
      .lean();

    return res.json(
      apiResponse.successResponse({ bids }, "Bids retrieved successfully"),
    );
  } catch (error) {
    logger.error("Error retrieving auction bids", { error: error.message });
    return res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Server error while retrieving bids",
          "SERVER_ERROR",
          500,
        ),
      );
  }
};

// Place a new bid on an auction
const placeBid = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { bidAmount } = req.body;

        if (!bidAmount || bidAmount <= 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json(
                apiResponse.errorResponse('Valid bid amount is required', 'INVALID_BID_AMOUNT', 400)
            );
        }

        const decimalBidAmount = fromString(String(bidAmount));

        const auction = await Auction.findById(id).session(session);

        if (!auction) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json(
                apiResponse.notFoundResponse('Auction', id)
            );
        }

        if (auction.status !== 'active' || auction.endTime <= new Date()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json(
                apiResponse.errorResponse('Auction is no longer active', 'AUCTION_ENDED', 400)
            );
        }

        if (auction.farmerId.toString() === req.user.id.toString()) {
            await session.abortTransaction();
            session.endSession();
            return res.status(403).json(
                apiResponse.errorResponse('You cannot bid on your own auction', 'FORBIDDEN', 403)
            );
        }

        if (lte(decimalBidAmount, auction.currentHighestBid)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json(
                apiResponse.errorResponse(`Bid amount must be greater than current highest bid (${toDecimal(auction.currentHighestBid).toString()})`, 'BID_TOO_LOW', 400)
            );
        }

        const user = await User.findById(req.user.id).session(session);
        
        if (!user || lt(user.balance, decimalBidAmount)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json(
                apiResponse.errorResponse('Insufficient balance', 'INSUFFICIENT_BALANCE', 400)
            );
        }

        // Refund previous highest bidder
        if (auction.highestBidder) {
            const previousBidder = await User.findById(auction.highestBidder).session(session);
            if (previousBidder) {
                const refundAmount = fromDecimal(toDecimal(previousBidder.balance).plus(toDecimal(auction.currentHighestBid)));
                previousBidder.balance = refundAmount;
                await previousBidder.save({ session });
            }
        }

        // Deduct new bid amount from current user
        const newBalance = fromDecimal(toDecimal(user.balance).minus(toDecimal(decimalBidAmount)));
        user.balance = newBalance;
        await user.save({ session });

        // Update auction
        auction.currentHighestBid = decimalBidAmount;
        auction.highestBidder = user._id;
        await auction.save({ session });

        // Create bid record
        const bid = new Bid({
            auctionId: auction._id,
            userId: user._id,
            userName: user.name,
            cropId: auction.batchId,
            bidAmount: decimalBidAmount
        });
        await bid.save({ session });

        await session.commitTransaction();
        session.endSession();

        logger.info('Bid placed successfully', { auctionId: auction._id, userId: user._id, amount: toDecimal(bidAmount).toString() });

        // Broadcast global bid event
        const io = socketService.getIO();
        if (io) {
            io.emit('bid_placed', {
                auctionId: auction._id,
                bid: {
                    userId: user._id,
                    userName: user.name,
                    bidAmount: toNumber(bidAmount),
                    timestamp: bid.timestamp
                },
                currentHighestBid: toNumber(bidAmount)
            });
        }

        return res.status(201).json(
            apiResponse.successResponse({ bid: { ...bid.toObject(), bidAmount: toNumber(bid.bidAmount) } }, 'Bid placed successfully', 201)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { bidAmount } = req.body;

    if (!bidAmount || bidAmount <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json(
          apiResponse.errorResponse(
            "Valid bid amount is required",
            "INVALID_BID_AMOUNT",
            400,
          ),
        );
    }

    const auction = await Auction.findById(id).session(session);

    if (!auction) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json(apiResponse.notFoundResponse("Auction", id));
    }

    if (auction.status !== "active" || auction.endTime <= new Date()) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json(
          apiResponse.errorResponse(
            "Auction is no longer active",
            "AUCTION_ENDED",
            400,
          ),
        );
    }

    if (auction.farmerId.toString() === req.user.id.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(403)
        .json(
          apiResponse.errorResponse(
            "You cannot bid on your own auction",
            "FORBIDDEN",
            403,
          ),
        );
    }

    if (bidAmount <= auction.currentHighestBid) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json(
          apiResponse.errorResponse(
            `Bid amount must be greater than current highest bid (${auction.currentHighestBid})`,
            "BID_TOO_LOW",
            400,
          ),
        );
    }

    const user = await User.findById(req.user.id).session(session);

    if (!user || user.balance < bidAmount) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json(
          apiResponse.errorResponse(
            "Insufficient balance",
            "INSUFFICIENT_BALANCE",
            400,
          ),
        );
    }

    // Refund previous highest bidder
    if (auction.highestBidder) {
      const previousBidder = await User.findById(auction.highestBidder).session(
        session,
      );
      if (previousBidder) {
        previousBidder.balance += auction.currentHighestBid;
        await previousBidder.save({ session });
      }
    }

    // Deduct new bid amount from current user
    user.balance -= bidAmount;
    await user.save({ session });

    // Update auction
    auction.currentHighestBid = bidAmount;
    auction.highestBidder = user._id;
    await auction.save({ session });

    // Create bid record
    const bid = new Bid({
      auctionId: auction._id,
      userId: user._id,
      userName: user.name,
      cropId: auction.batchId,
      bidAmount: bidAmount,
    });
    await bid.save({ session });

    await session.commitTransaction();
    session.endSession();

    logger.info("Bid placed successfully", {
      auctionId: auction._id,
      userId: user._id,
      amount: bidAmount,
    });

    // Broadcast global bid event
    const io = socketService.getIO();
    if (io) {
      io.emit("bid_placed", {
        auctionId: auction._id,
        bid: {
          userId: user._id,
          userName: user.name,
          bidAmount: bidAmount,
          timestamp: bid.timestamp,
        },
        currentHighestBid: bidAmount,
      });
    }

    return res
      .status(201)
      .json(
        apiResponse.successResponse({ bid }, "Bid placed successfully", 201),
      );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error("Error placing bid", { error: error.message });
    return res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Server error while placing bid",
          "SERVER_ERROR",
          500,
        ),
      );
  }
};

module.exports = {
  createAuction,
  getAllAuctions,
  getAuctionDetails,
  getAuctionBids,
  placeBid,
};
