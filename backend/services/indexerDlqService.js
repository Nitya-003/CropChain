const DeadLetterEvent = require("../models/DeadLetterEvent");
const logger = require("../utils/logger");

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Pushes an unprocessable event to the Dead Letter Queue.
 */
async function pushToDlq({ eventId, batchId, blockNumber, rawPayload, errorReason }) {
  try {
    const dlqItem = await DeadLetterEvent.create({
      eventId: eventId || `dlq-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      batchId: batchId || "UNKNOWN",
      blockNumber: blockNumber || 0,
      rawPayload: rawPayload || {},
      errorReason: errorReason || "Unknown indexing error",
      retryCount: 0,
      status: "PENDING",
    });

    logger.warn(`[DLQ] Pushed event ${dlqItem.eventId} to Dead Letter Queue: ${errorReason}`);
    return dlqItem;
  } catch (err) {
    logger.error(`[DLQ] Failed to push event to DLQ: ${err.message}`);
    throw err;
  }
}

/**
 * Retries processing pending DLQ events with exponential backoff strategy.
 */
async function retryDlqEvents(processCallback) {
  const pendingEvents = await DeadLetterEvent.find({
    status: "PENDING",
    retryCount: { $lt: MAX_RETRIES },
  });

  const results = { succeeded: 0, failed: 0, exhausted: 0 };

  for (const item of pendingEvents) {
    const attempt = item.retryCount + 1;
    const backoffDelay = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);

    await new Promise((resolve) => setTimeout(resolve, backoffDelay));

    try {
      if (processCallback) {
        await processCallback(item.rawPayload);
      }

      item.status = "PROCESSED";
      item.retryCount = attempt;
      await item.save();
      results.succeeded++;
      logger.info(`[DLQ] Successfully reprocessed event ${item.eventId} on attempt ${attempt}`);
    } catch (err) {
      item.retryCount = attempt;
      if (attempt >= MAX_RETRIES) {
        item.status = "FAILED";
        results.exhausted++;
        logger.error(`[DLQ] Event ${item.eventId} exhausted retries (${MAX_RETRIES}). Marked FAILED.`);
      } else {
        results.failed++;
      }
      await item.save();
    }
  }

  return results;
}

module.exports = {
  pushToDlq,
  retryDlqEvents,
  MAX_RETRIES,
};
