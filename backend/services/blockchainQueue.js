/**
 * Blockchain Queue Service
 * 
 * This service manages the job queue for blockchain transactions using BullMQ.
 * It provides methods to add, monitor, and manage blockchain transaction jobs.
 * 
 * Features:
 * - Asynchronous job processing for createBatch and updateBatch operations
 * - Configurable retry strategies with exponential backoff
 * - Job priority support for urgent transactions
 * - Dead letter queue for failed jobs
 * - Job status tracking and monitoring
 */

const { Queue, QueueEvents } = require('bullmq');
const { createQueueConnection } = require('../config/redis');
const logger = require('../utils/logger');

// Queue names
const QUEUE_NAMES = {
    BLOCKCHAIN: 'blockchain-transactions',
    DEAD_LETTER: 'blockchain-dead-letter'
};

// Job types
const JOB_TYPES = {
    CREATE_BATCH: 'createBatch',
    UPDATE_BATCH: 'updateBatch',
    RECALL_BATCH: 'recallBatch'
};

// Job priorities (lower number = higher priority)
const JOB_PRIORITIES = {
    URGENT: 1,
    HIGH: 5,
    NORMAL: 10,
    LOW: 20
};

// Default job options
const DEFAULT_JOB_OPTIONS = {
    attempts: parseInt(process.env.BLOCKCHAIN_MAX_RETRIES, 10) || 5,
    backoff: {
        type: 'exponential',
        delay: parseInt(process.env.BLOCKCHAIN_RETRY_DELAY, 10) || 5000 // 5 seconds initial delay
    },
    removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
        count: 1000     // Keep max 1000 completed jobs
    },
    removeOnFail: {
        age: 7 * 24 * 3600 // Keep failed jobs for 7 days for debugging
    }
};

// Queue instance (singleton)
let blockchainQueue = null;
let queueEvents = null;

/**
 * Initialize the blockchain transaction queue
 * @returns {Queue} BullMQ Queue instance
 */
function initializeQueue() {
    if (blockchainQueue) {
        return blockchainQueue;
    }

    const connection = createQueueConnection();

    blockchainQueue = new Queue(QUEUE_NAMES.BLOCKCHAIN, {
        connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS
    });

    // Queue events for monitoring
    queueEvents = new QueueEvents(QUEUE_NAMES.BLOCKCHAIN, {
        connection: createQueueConnection()
    });

    // Log queue events
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
        logger.info(`[Queue] Job ${jobId} completed:`, returnvalue);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
        logger.error(`[Queue] Job ${jobId} failed:`, failedReason);
    });

    queueEvents.on('progress', ({ jobId, data }) => {
        logger.info(`[Queue] Job ${jobId} progress:`, data);
    });

    queueEvents.on('error', (error) => {
        logger.error('[Queue] Queue event error:', error.message);
    });

    logger.info('✓ Blockchain transaction queue initialized');
    return blockchainQueue;
}

/**
 * Get the queue instance
 * @returns {Queue|null}
 */
function getQueue() {
    return blockchainQueue;
}

/**
 * Get queue events instance
 * @returns {QueueEvents|null}
 */
function getQueueEvents() {
    return queueEvents;
}

/**
 * Add a create batch job to the queue
 * @param {Object} batchData - Batch data to be stored on blockchain
 * @param {Object} options - Job options (priority, delay, etc.)
 * @returns {Promise<Job>} Created job
 */
async function addCreateBatchJob(batchData, options = {}) {
    const queue = getQueue();
    if (!queue) {
        throw new Error('Queue not initialized');
    }

    const job = await queue.add(JOB_TYPES.CREATE_BATCH, {
        type: JOB_TYPES.CREATE_BATCH,
        batchId: batchData.batchId,
        data: batchData,
        timestamp: Date.now()
    }, {
        priority: options.priority || JOB_PRIORITIES.NORMAL,
        ...options
    });

    logger.info(`[Queue] Added createBatch job ${job.id} for batch ${batchData.batchId}`);
    return job;
}

/**
 * Add an update batch job to the queue
 * @param {string} batchId - Batch ID to update
 * @param {Object} updateData - Update data to be stored on blockchain
 * @param {Object} options - Job options
 * @returns {Promise<Job>} Created job
 */
async function addUpdateBatchJob(batchId, updateData, options = {}) {
    const queue = getQueue();
    if (!queue) {
        throw new Error('Queue not initialized');
    }

    const job = await queue.add(JOB_TYPES.UPDATE_BATCH, {
        type: JOB_TYPES.UPDATE_BATCH,
        batchId,
        data: updateData,
        timestamp: Date.now()
    }, {
        priority: options.priority || JOB_PRIORITIES.NORMAL,
        ...options
    });

    logger.info(`[Queue] Added updateBatch job ${job.id} for batch ${batchId}`);
    return job;
}

/**
 * Add a recall batch job to the queue
 * @param {string} batchId - Batch ID to recall
 * @param {Object} options - Job options
 * @returns {Promise<Job>} Created job
 */
async function addRecallBatchJob(batchId, options = {}) {
    const queue = getQueue();
    if (!queue) {
        throw new Error('Queue not initialized');
    }

    const job = await queue.add(JOB_TYPES.RECALL_BATCH, {
        type: JOB_TYPES.RECALL_BATCH,
        batchId,
        timestamp: Date.now()
    }, {
        priority: options.priority || JOB_PRIORITIES.HIGH, // Recalls are high priority
        ...options
    });

    logger.info(`[Queue] Added recallBatch job ${job.id} for batch ${batchId}`);
    return job;
}

/**
 * Get job status and details
 * @param {string} jobId - Job ID
 * @returns {Promise<Object|null>} Job status object
 */
async function getJobStatus(jobId) {
    const queue = getQueue();
    if (!queue) {
        throw new Error('Queue not initialized');
    }

    const job = await queue.getJob(jobId);
    if (!job) {
        return null;
    }

    const state = await job.getState();

    return {
        jobId: job.id,
        type: job.data.type,
        batchId: job.data.batchId,
        state,
        progress: job.progress,
        returnvalue: job.returnvalue,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        attempts: job.opts.attempts,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        data: job.data
    };
}

/**
 * Get all jobs for a specific batch
 * @param {string} batchId - Batch ID
 * @returns {Promise<Array>} Array of job statuses
 */
async function getJobsByBatchId(batchId) {
    const queue = getQueue();
    if (!queue) {
        throw new Error('Queue not initialized');
    }

    const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);
    const batchJobs = jobs.filter(job => job.data.batchId === batchId);
    
    const jobStatuses = await Promise.all(
        batchJobs.map(async (job) => {
            const state = await job.getState();
            return {
                jobId: job.id,
                type: job.data.type,
                state,
                progress: job.progress,
                failedReason: job.failedReason,
                timestamp: job.timestamp,
                finishedOn: job.finishedOn
            };
        })
    );

    return jobStatuses;
}

/**
 * Get queue statistics
 * @returns {Promise<Object>} Queue statistics
 */
async function getQueueStats() {
    const queue = getQueue();
    if (!queue) {
        throw new Error('Queue not initialized');
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount()
    ]);

    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        total: waiting + active + completed + failed + delayed
    };
}

/**
 * Retry a failed job
 * @param {string} jobId - Job ID to retry
 * @returns {Promise<boolean>} True if retry was successful
 */
async function retryJob(jobId) {
    const queue = getQueue();
    if (!queue) {
        throw new Error('Queue not initialized');
    }

    const job = await queue.getJob(jobId);
    if (!job) {
        throw new Error(`Job ${jobId} not found`);
    }

    await job.retry();
    logger.info(`[Queue] Retrying job ${jobId}`);
    return true;
}

/**
 * Close the queue gracefully
 */
async function closeQueue() {
    if (queueEvents) {
        await queueEvents.close();
        queueEvents = null;
    }

    if (blockchainQueue) {
        await blockchainQueue.close();
        blockchainQueue = null;
        logger.info('✓ Blockchain queue closed');
    }
}

/**
 * Pause the queue (stops processing new jobs)
 */
async function pauseQueue() {
    const queue = getQueue();
    if (!queue) return;

    await queue.pause();
    logger.info('[Queue] Queue paused');
}

/**
 * Resume the queue
 */
async function resumeQueue() {
    const queue = getQueue();
    if (!queue) return;

    await queue.resume();
    logger.info('[Queue] Queue resumed');
}

module.exports = {
    QUEUE_NAMES,
    JOB_TYPES,
    JOB_PRIORITIES,
    initializeQueue,
    getQueue,
    getQueueEvents,
    addCreateBatchJob,
    addUpdateBatchJob,
    addRecallBatchJob,
    getJobStatus,
    getJobsByBatchId,
    getQueueStats,
    retryJob,
    closeQueue,
    pauseQueue,
    resumeQueue
};


