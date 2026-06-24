const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getActivities, getActivityFeed, getActivityById } = require('../controllers/activityController');

// All activity routes require authentication
router.use(protect);

// GET /api/activities/feed - personalized activity timeline (all authenticated roles)
router.get('/feed', getActivityFeed);

// GET /api/activities - retrieve all activities (Admin only filter-supported query)
router.get('/', getActivities);

// GET /api/activities/:id - retrieve a single activity by ID
router.get('/:id', getActivityById);

module.exports = router;
