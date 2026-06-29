const express = require('express');
const router = express.Router();
const { 
    getUserNotifications, 
    markAsRead, 
    markAllAsRead, 
    getUnreadCount 
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// All notification routes require authentication
router.use(protect);

router.get('/', getUserNotifications);
router.get('/unread-count', getUnreadCount);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

module.exports = router;
