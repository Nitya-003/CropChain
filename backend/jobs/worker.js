const { Worker } = require("bullmq");
const { createQueueConnection } = require("../config/redis");
const { QUEUE_NAMES, JOB_TYPES, addEmailJob } = require("./queue");
const { sendEmail, compileTemplate } = require("../services/emailService");
const Batch = require("../models/Batch");
const User = require("../models/User");
const logger = require("../utils/logger");

let worker = null;

/**
 * Process a sendEmail job
 * @param {Object} job
 */
async function processSendEmail(job) {
  const { to, subject, templateData } = job.data;
  console.log(`[NotificationWorker] Sending email to ${to}`);
  logger.info(`[NotificationWorker] Sending email to ${to}`);

  await job.updateProgress(10);
  
  // Handle backward compatibility (if raw html is sent) or use templating
  let html = job.data.html;
  if (templateData && templateData.templateName) {
    try {
      html = compileTemplate(templateData.templateName, templateData.context || {});
    } catch (err) {
      console.error(`[NotificationWorker] Template compilation failed:`, err.message);
      throw new Error(`Template compilation failed: ${err.message}`);
    }
  }

  const result = await sendEmail(to, subject, html);
  await job.updateProgress(100);

  if (!result.success && !result.fallback) {
    throw new Error(result.error || "Failed to send email");
  }

  return result;
}

/**
 * Process delayed alert checks
 * @param {Object} job
 */
async function processDelayedAlertCheck(job) {
  logger.info(`[NotificationWorker] Running delayed alert check...`);

  const thresholdDays = parseInt(process.env.DELAYED_ALERT_DAYS, 10) || 3;
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

  // Find active batches not in terminal stage (retailer) that haven't been updated recently
  const delayedBatches = await Batch.find({
    isRecalled: false,
    currentStage: { $ne: "retailer" },
    updatedAt: { $lt: thresholdDate },
  }).lean();

  logger.info(
    `[NotificationWorker] Found ${delayedBatches.length} delayed batches.`,
  );
  await job.updateProgress(50);

  let emailsQueued = 0;

  for (const batch of delayedBatches) {
    // We need to notify the farmer/owner
    const farmer = await User.findById(batch.farmerId).lean();
    if (farmer && farmer.email) {
      const subject = `Supply Chain Alert: Batch ${batch.batchId} Delayed`;
      const templateData = {
        templateName: "delayedAlert",
        context: {
          farmerName: farmer.name || farmer.email,
          batchId: batch.batchId,
          cropType: batch.cropType,
          currentStage: batch.currentStage,
          thresholdDays: thresholdDays,
          dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`
        }
      };
      await addEmailJob(farmer.email, subject, templateData);
      emailsQueued++;
    }
  }

  await job.updateProgress(100);
  return {
    success: true,
    delayedBatchesCount: delayedBatches.length,
    emailsQueued,
  };
}

/**
 * Job processor router
 */
async function processJob(job) {
  switch (job.name) {
    case JOB_TYPES.SEND_EMAIL:
      return processSendEmail(job);
    case JOB_TYPES.DELAYED_ALERT_CHECK:
      return processDelayedAlertCheck(job);
    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}

/**
 * Initialize the notification worker
 * @returns {Worker} BullMQ Worker instance
 */
function initializeWorker() {
  if (worker) {
    return worker;
  }

  const connection = createQueueConnection();

  worker = new Worker(QUEUE_NAMES.NOTIFICATIONS, processJob, {
    connection,
    concurrency: 5, // Process up to 5 emails/tasks concurrently
    limiter: {
      max: 20,
      duration: 1000, // Rate limit: max 20 jobs per second
    },
  });

  worker.on("completed", (job, result) => {
    logger.info(`[NotificationWorker] Job ${job.id} completed`, { result });
  });

  worker.on("failed", (job, err) => {
    logger.error(`[NotificationWorker] Job ${job?.id} failed`, { error: err.message });
  });

  worker.on("error", (err) => {
    logger.error("[NotificationWorker] Worker error", { error: err.message });
  });

  logger.info("✓ Notification worker started");
  return worker;
}

function getWorker() {
  return worker;
}

async function stopWorker() {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("✓ Notification worker stopped");
  }
}

module.exports = {
  initializeWorker,
  getWorker,
  stopWorker,
  processJob,
};
