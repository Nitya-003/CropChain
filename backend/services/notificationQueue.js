const { Queue, QueueEvents } = require('bullmq');
const { createQueueConnection } = require('../config/redis');

// Queue names
const QUEUE_NAMES = {
    NOTIFICATIONS: 'notifications-queue'
};

// Job types
const JOB_TYPES = {
    SEND_EMAIL: 'sendEmail',
    DELAYED_ALERT_CHECK: 'delayedAlertCheck'
};

// Default job options
const DEFAULT_JOB_OPTIONS = {
    attempts: 3,
    backoff: {
        type: 'exponential',
        delay: 5000 // 5 seconds initial delay
    },
    removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000     // Keep max 1000 completed jobs
    },
    removeOnFail: {
        age: 7 * 24 * 3600 // Keep failed jobs for 7 days
    }
};

let notificationQueue = null;
let queueEvents = null;

/**
 * Initialize the notification queue
 * @returns {Queue} BullMQ Queue instance
 */
function initializeQueue() {
    if (notificationQueue) {
        return notificationQueue;
    }

    const connection = createQueueConnection();

    notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATIONS, {
        connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS
    });

    queueEvents = new QueueEvents(QUEUE_NAMES.NOTIFICATIONS, {
        connection: createQueueConnection()
    });

    queueEvents.on('completed', ({ jobId }) => {
        console.log(`[NotificationQueue] Job ${jobId} completed.`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
        console.error(`[NotificationQueue] Job ${jobId} failed:`, failedReason);
    });

    console.log('✓ Notification queue initialized');

    // Add a repeatable job for checking delayed supply chain alerts once per day
    notificationQueue.add(
        JOB_TYPES.DELAYED_ALERT_CHECK,
        {},
        {
            repeat: {
                pattern: '0 0 * * *' // Every day at midnight
            },
            jobId: 'daily-delayed-alert-check' // Ensure it's unique and replaced if exists
        }
    ).catch(err => console.error('[NotificationQueue] Error setting up repeatable alert check:', err));

    return notificationQueue;
}

/**
 * Get the queue instance
 * @returns {Queue|null}
 */
function getQueue() {
    return notificationQueue;
}

/**
 * Add an email job to the queue
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML content of the email
 * @param {Object} options - Job options
 */
async function addEmailJob(to, subject, html, options = {}) {
    const queue = getQueue();
    if (!queue) {
        console.warn('[NotificationQueue] Queue not initialized, cannot add email job.');
        return null;
    }

    const job = await queue.add(JOB_TYPES.SEND_EMAIL, {
        to,
        subject,
        html
    }, {
        priority: 10,
        ...options
    });

    console.log(`[NotificationQueue] Added email job ${job.id} for ${to}`);
    return job;
}

/**
 * Close the queue gracefully
 */
async function closeQueue() {
    if (queueEvents) {
        await queueEvents.close();
        queueEvents = null;
    }

    if (notificationQueue) {
        await notificationQueue.close();
        notificationQueue = null;
        console.log('✓ Notification queue closed');
    }
}

module.exports = {
    QUEUE_NAMES,
    JOB_TYPES,
    initializeQueue,
    getQueue,
    addEmailJob,
    closeQueue
};
