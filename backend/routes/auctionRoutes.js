const express = require('express');
const router = express.Router();
const {
    createAuction,
    getAllAuctions,
    getAuctionDetails,
    getAuctionBids
} = require('../controllers/auctionController');
const { protect } = require('../middleware/auth');
const { batchLimiter } = require('../middleware/rateLimiters');

// Protected auction endpoints
router.post('/', protect, batchLimiter, createAuction);
router.get('/', protect, getAllAuctions);
router.get('/:id', protect, getAuctionDetails);
router.get('/:id/bids', protect, getAuctionBids);

module.exports = router;
