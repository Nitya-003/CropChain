const express = require('express');
const router = express.Router();
const { 
    getUserNotifications, 
    markAsRead, 
    markAllAsRead, 
    getUnreadCount 
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { notificationLimiter } = require('../middleware/rateLimiters');

// All notification routes require authentication
router.use(protect);
router.use(notificationLimiter);

router.get('/', getUserNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;
