/**
 * NotificationService - Handles all notifications and alerts
 * Extracted from server.js to follow Separation of Concerns principle
 */

const emailProvider = require('../config/email');
const logger = require('../utils/logger');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { addEmailJob } = require('./notificationQueue');

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
                logger.warn(`[${type.toUpperCase()}] ${message}`, metadata);
                break;
            case 'error':
                logger.error(`[${type.toUpperCase()}] ${message}`, metadata);
                break;
            default:
                logger.info(`[${type.toUpperCase()}] ${message}`, metadata);
        }

        return notification;
    }

    async createInAppNotification(userId, title, message, type = 'update', data = {}) {
        try {
            if (!userId) return null;
            const notification = await Notification.create({
                user: userId,
                title,
                message,
                type,
                data
            });
            
            // Emit to connected client via WebSocket
            const { emitToUser } = require('./socketService');
            emitToUser(userId.toString(), 'new_notification', notification);
            
            return notification;
        } catch (error) {
            logger.error('[NotificationService] Failed to create in-app notification:', error.message);
            return null;
        }
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
    async sendRecallNotification(batch, adminUser) {
        this.log('recall', `Batch ${batch.batchId} has been recalled`, {
            batchId: batch.batchId,
            cropType: batch.cropType,
            quantity: batch.quantity,
            recalledBy: adminUser.email,
            recalledAt: new Date().toISOString()
        });

        if (adminUser.email) {
            await this.sendEmail(
                adminUser.email,
                `🚨 RECALL: Batch ${batch.batchId}`,
                `<h2>Batch Recall Notice</h2><p>Batch <strong>${batch.batchId}</strong> (${batch.cropType}, ${batch.quantity}kg) has been <strong>recalled</strong>.</p><p>Recalled by: ${adminUser.email}</p><p>CropChain Team</p>`
            );
        }

        if (batch.farmerId) {
            const farmer = await User.findById(batch.farmerId);
            if (farmer && farmer.email) {
                await this.sendEmail(
                    `${farmer.name || batch.farmerName} <${farmer.email}>`,
                    `🚨 RECALL: Batch ${batch.batchId}`,
                    `<h2>Batch Recall Notice - Action Required</h2><p>Your batch <strong>${batch.batchId}</strong> (${batch.cropType}, ${batch.quantity}kg) has been <strong>recalled</strong>.</p><p>Please check the CropChain dashboard for further instructions.</p><p>CropChain Team</p>`
                );
            }
            await this.createInAppNotification(
                batch.farmerId,
                'BATCH RECALLED',
                `Batch ${batch.batchId} has been recalled.`,
                'recall',
                { batchId: batch.batchId }
            );
        }
    }

    /**
     * Notify about successful batch creation
     * @param {string} batchId - Batch identifier
     * @param {Object} user - User who created the batch
     */
    async notifyBatchCreated(batchId, user) {
        this.log('info', `Batch created: ${batchId}`, {
            batchId,
            createdBy: user.email || user.id,
            timestamp: new Date().toISOString()
        });

        if (user.email) {
            await this.sendEmail(
                user.email,
                `Batch Created: ${batchId}`,
                `<h2>Batch Created Successfully</h2><p>Your batch <strong>${batchId}</strong> has been created and recorded on the blockchain.</p><p>CropChain Team</p>`
            );
        }
        
        if (user._id || user.id) {
            await this.createInAppNotification(
                user._id || user.id,
                'Batch Created',
                `Your new batch ${batchId} has been successfully recorded.`,
                'update',
                { batchId }
            );
        }
    }

    /**
     * Notify about batch update
     * @param {string} batchId - Batch identifier
     * @param {string} stage - New stage
     * @param {Object} user - User who updated the batch
     * @param {Object} batch - Optional batch object to identify stakeholders
     */
    async notifyBatchUpdated(batchId, stage, user, batch = null) {
        this.log('info', `Batch updated: ${batchId} to stage ${stage}`, {
            batchId,
            stage,
            updatedBy: user.email || user.id,
            timestamp: new Date().toISOString()
        });

        if (user.email) {
            await this.sendEmail(
                user.email,
                `Batch Updated: ${batchId}`,
                `<h2>Batch Stage Updated</h2><p>Batch <strong>${batchId}</strong> has moved to stage <strong>${stage}</strong>.</p><p>CropChain Team</p>`
            );
        }

        if (user._id || user.id) {
            await this.createInAppNotification(
                user._id || user.id,
                'Batch Stage Updated',
                `Batch ${batchId} has moved to stage: ${stage}.`,
                'update',
                { batchId, stage }
            );
        }
        
        // Notify stakeholders (farmer) if different from updater
        if (batch && batch.farmerId && batch.farmerId.toString() !== (user._id || user.id).toString()) {
            await this.createInAppNotification(
                batch.farmerId,
                'Batch Stage Updated',
                `Your batch ${batchId} has moved to stage: ${stage}.`,
                'update',
                { batchId, stage }
            );
        }

        // Emit a global event for stakeholders listening on dashboard
        this.broadcast('batch-stage-changed', {
            batchId,
            stage,
            actor: user.name || user.email,
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
     * Send email notification via BullMQ queue
     * @param {string} to - Recipient email
     * @param {string} subject - Email subject
     * @param {string} body - Email body (HTML)
     */
    async sendEmail(to, subject, body) {
        try {
            const job = await addEmailJob(to, subject, body);
            if (job) {
                this.log('email', `Email queued: ${subject}`, { to, subject, jobId: job.id });
                return { success: true, queued: true, jobId: job.id };
            }
        } catch (error) {
            this.log('error', `Failed to queue email: ${subject}`, { to, subject, error: error.message });
        }
        
        // Fallback to synchronous if queue is unavailable
        const result = await emailProvider.sendEmail(to, subject, body);
        if (result.fallback) {
            this.log('email', `Email logged (SMTP not configured): ${subject}`, { to, subject });
        } else if (result.success) {
            this.log('email', `Email sent synchronously: ${subject}`, { to, subject, messageId: result.messageId });
        } else {
            this.log('error', `Email failed: ${subject}`, { to, subject, error: result.error });
        }
        return result;
    }

    /**
     * Send push notification (placeholder for future implementation)
     * @param {string} userId - User ID
     * @param {string} title - Notification title
     * @param {string} body - Notification body
     */
    async sendPushNotification(userId, title, body) {
        // Placeholder for push notifications (e.g., Firebase Cloud Messaging)
        logger.info(`[PUSH] Would send push to user ${userId}: ${title}`);
        
        this.log('push', `Push notification: ${title}`, { userId, title, body });
    }

    /**
     * Broadcast to WebSocket clients via Socket.IO
     * @param {string} event - Event name
     * @param {Object} data - Data to broadcast
     */
    async broadcast(event, data) {
        try {
            const { emitGlobal } = require('./socketService');
            emitGlobal(event, data);
        } catch (err) {
            logger.warn('[WS] Socket.IO not available for broadcast:', err.message);
        }

        this.log('broadcast', `WebSocket broadcast: ${event}`, { event, data });
    }
}

// Export singleton instance
module.exports = new NotificationService();

