/**
 * NotificationService - Handles all notifications and alerts
 * Extracted from server.js to follow Separation of Concerns principle
 */

class NotificationService {
    constructor() {
        this.notificationHistory = [];
        this.maxHistorySize = 100;
    }

    /**
     * Log a notification to console and history
     * @param {string} type - Notification type
     * @param {string} message - Notification message
     * @param {Object} metadata - Additional metadata
     */
    log(type, message, metadata = {}) {
        const notification = {
            type,
            message,
            metadata,
            timestamp: new Date().toISOString()
        };

        // Keep history limited
        if (this.notificationHistory.length >= this.maxHistorySize) {
            this.notificationHistory.shift();
        }
        this.notificationHistory.push(notification);

        // Log based on type
        switch (type) {
            case 'alert':
            case 'recall':
                console.warn(`[${type.toUpperCase()}] ${message}`, metadata);
                break;
            case 'error':
                console.error(`[${type.toUpperCase()}] ${message}`, metadata);
                break;
            default:
                console.log(`[${type.toUpperCase()}] ${message}`, metadata);
        }

        return notification;
    }

    /**
     * Alert about a recalled batch being viewed
     * @param {string} batchId - Batch identifier
     */
    alertRecall(batchId) {
        return this.log('alert', `🚨 ALERT: Recalled batch viewed: ${batchId}`, { batchId });
    }

    /**
     * Send recall notification when a batch is recalled
     * @param {Object} batch - Batch document
     * @param {Object} adminUser - Admin user who initiated recall
     */
    sendRecallNotification(batch, adminUser) {
        return this.log('recall', `Batch ${batch.batchId} has been recalled`, {
            batchId: batch.batchId,
            cropType: batch.cropType,
            quantity: batch.quantity,
            recalledBy: adminUser.email,
            recalledAt: new Date().toISOString()
        });
    }

    /**
     * Notify about successful batch creation
     * @param {string} batchId - Batch identifier
     * @param {Object} user - User who created the batch
     */
    notifyBatchCreated(batchId, user) {
        return this.log('info', `Batch created: ${batchId}`, {
            batchId,
            createdBy: user.email || user.id,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Notify about batch update
     * @param {string} batchId - Batch identifier
     * @param {string} stage - New stage
     * @param {Object} user - User who updated the batch
     */
    notifyBatchUpdated(batchId, stage, user) {
        return this.log('info', `Batch updated: ${batchId} to stage ${stage}`, {
            batchId,
            stage,
            updatedBy: user.email || user.id,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Notify about security events
     * @param {string} eventType - Type of security event
     * @param {Object} details - Event details
     */
    notifySecurityEvent(eventType, details) {
        return this.log('security', `Security event: ${eventType}`, {
            ...details,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Notify about errors
     * @param {string} operation - Operation that failed
     * @param {Error} error - Error object
     */
    notifyError(operation, error) {
        return this.log('error', `Error in ${operation}: ${error.message}`, {
            operation,
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Get notification history
     * @param {number} limit - Maximum number of notifications to return
     * @returns {Array} - Notification history
     */
    getHistory(limit = 50) {
        return this.notificationHistory.slice(-limit);
    }

    /**
     * Clear notification history
     */
    clearHistory() {
        this.notificationHistory = [];
    }

    /**
     * Get notifications by type
     * @param {string} type - Notification type
     * @returns {Array} - Filtered notifications
     */
    getByType(type) {
        return this.notificationHistory.filter(n => n.type === type);
    }

    /**
     * Send email notification (placeholder for future implementation)
     * @param {string} to - Recipient email
     * @param {string} subject - Email subject
     * @param {string} body - Email body
     */
    async sendEmail(to, subject, body) {
        // Placeholder for email integration (e.g., SendGrid, Nodemailer)
        console.log(`[EMAIL] Would send email to ${to}: ${subject}`);
        
        this.log('email', `Email queued: ${subject}`, { to, subject });
        
        // Future implementation:
        // const transporter = require('./config/email');
        // await transporter.sendMail({ to, subject, html: body });
    }

    /**
     * Send push notification (placeholder for future implementation)
     * @param {string} userId - User ID
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     */
    async sendPushNotification(userId, title, body) {
        // Placeholder for push notifications (e.g., Firebase Cloud Messaging)
        console.log(`[PUSH] Would send push to user ${userId}: ${title}`);
        
        this.log('push', `Push notification: ${title}`, { userId, title, body });
    }

    /**
     * Broadcast to WebSocket clients (placeholder for future implementation)
     * @param {string} event - Event name
     * @param {Object} data - Data to broadcast
     */
    async broadcast(event, data) {
        // Placeholder for WebSocket broadcasting
        console.log(`[WS] Would broadcast ${event}:`, data);
        
        this.log('broadcast', `WebSocket broadcast: ${event}`, { event, data });
        
        // Future implementation:
        // const wss = require('./config/websocket');
        // wss.clients.forEach(client => client.send(JSON.stringify({ event, data })));
    }
}

// Export singleton instance
module.exports = new NotificationService();
