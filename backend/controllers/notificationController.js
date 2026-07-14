const Notification = require('../models/Notification');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

const DEFAULT_NOTIFICATION_LIMIT = 50;
const MAX_NOTIFICATION_LIMIT = 100;

/**
 * Get all notifications for the current user
 * @route GET /api/notifications
 * @access Private
 */
exports.getUserNotifications = async (req, res) => {
    try {
        const rawLimit = req.query.limit;
        let limit = DEFAULT_NOTIFICATION_LIMIT;

        if (rawLimit !== undefined) {
            const limitValue = String(rawLimit);
            if (!/^\d+$/.test(limitValue)) {
                return res.status(400).json(
                    apiResponse.errorResponse(
                        `Notification limit must be an integer between 1 and ${MAX_NOTIFICATION_LIMIT}`,
                        'INVALID_NOTIFICATION_LIMIT',
                        400
                    )
                );
            }

            limit = Number(limitValue);
            if (!Number.isInteger(limit) || limit < 1 || limit > MAX_NOTIFICATION_LIMIT) {
                return res.status(400).json(
                    apiResponse.errorResponse(
                        `Notification limit must be an integer between 1 and ${MAX_NOTIFICATION_LIMIT}`,
                        'INVALID_NOTIFICATION_LIMIT',
                        400
                    )
                );
            }
        }

        const notifications = await Notification.find({ user: req.user.id || req.user._id })
            .sort({ createdAt: -1 })
            .limit(limit);

        res.status(200).json(
            apiResponse.successResponse({ notifications }, 'Notifications retrieved successfully')
        );
    } catch (error) {
        logger.error('Error fetching notifications', { error: error.message, userId: req.user?.id });
        res.status(500).json(
            apiResponse.errorResponse('Failed to fetch notifications', 'NOTIFICATION_FETCH_ERROR')
        );
    }
};

/**
 * Get unread notification count
 * @route GET /api/notifications/unread-count
 * @access Private
 */
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ user: req.user.id || req.user._id, read: false });

        res.status(200).json(
            apiResponse.successResponse({ count }, 'Unread count retrieved successfully')
        );
    } catch (error) {
        logger.error('Error fetching unread count', { error: error.message, userId: req.user?.id });
        res.status(500).json(
            apiResponse.errorResponse('Failed to fetch unread count', 'NOTIFICATION_COUNT_ERROR')
        );
    }
};

/**
 * Mark a specific notification as read
 * @route PUT /api/notifications/:id/read
 * @access Private
 */
exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, user: req.user.id || req.user._id },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json(
                apiResponse.errorResponse('Notification not found', 'NOTIFICATION_NOT_FOUND', 404)
            );
        }

        res.status(200).json(
            apiResponse.successResponse({ notification }, 'Notification marked as read')
        );
    } catch (error) {
        logger.error('Error marking notification as read', { error: error.message, id: req.params.id });
        res.status(500).json(
            apiResponse.errorResponse('Failed to mark notification as read', 'NOTIFICATION_UPDATE_ERROR')
        );
    }
};

/**
 * Mark all notifications as read for the current user
 * @route PUT /api/notifications/read-all
 * @access Private
 */
exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { user: req.user.id || req.user._id, read: false },
            { read: true }
        );

        res.status(200).json(
            apiResponse.successResponse({}, 'All notifications marked as read')
        );
    } catch (error) {
        logger.error('Error marking all notifications as read', { error: error.message, userId: req.user?.id });
        res.status(500).json(
            apiResponse.errorResponse('Failed to mark all notifications as read', 'NOTIFICATION_UPDATE_ERROR')
        );
    }
};
