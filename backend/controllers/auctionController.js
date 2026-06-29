const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Batch = require('../models/Batch');
const User = require('../models/User');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const socketService = require('../services/socketService');

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

        const auction = new Auction({
            cropId: batch._id,
            batchId: batch.batchId,
            farmerId: req.user.id,
            startPrice,
            currentHighestBid: startPrice,
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
                startPrice: auction.startPrice,
                endTime: auction.endTime
            });
        }

        return res.status(201).json(
            apiResponse.successResponse({ auction }, 'Auction created successfully', 201)
        );

    } catch (error) {
        logger.error('Error creating auction', { error: error.message });
        return res.status(500).json(
            apiResponse.errorResponse('Server error while creating auction', 'SERVER_ERROR', 500)
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
    }
};

// Get detailed information for a single auction
const getAuctionDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const auction = await Auction.findById(id).lean();

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
    }
};

// Get bidding history for a single auction
const getAuctionBids = async (req, res) => {
    try {
        const { id } = req.params;
        const bids = await Bid.find({ auctionId: id })
            .sort({ timestamp: -1 })
            .lean();

        return res.json(
            apiResponse.successResponse({ bids }, 'Bids retrieved successfully')
        );
    } catch (error) {
        logger.error('Error retrieving auction bids', { error: error.message });
        return res.status(500).json(
            apiResponse.errorResponse('Server error while retrieving bids', 'SERVER_ERROR', 500)
        );
    }
};

module.exports = {
    createAuction,
    getAllAuctions,
    getAuctionDetails,
    getAuctionBids
};
