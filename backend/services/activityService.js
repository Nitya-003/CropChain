const Activity = require("../models/Activity");
const logger = require("../utils/logger");

/**
 * Log a platform activity
 * @param {Object} params
 * @param {string} params.userId - User ID performing the action
 * @param {string} params.userRole - Role of the user
 * @param {string} params.eventType - Event type
 * @param {string} [params.batchId] - Related batch ID
 * @param {string} params.description - Human-readable explanation
 * @param {Object} [params.metadata] - Optional additional details
 */
exports.logActivity = async ({
  userId,
  userRole,
  eventType,
  batchId,
  description,
  metadata = {},
}) => {
  try {
    const activity = await Activity.create({
      userId: String(userId),
      userRole,
      eventType,
      batchId,
      description,
      metadata,
    });
    logger.info("Activity logged successfully", {
      activityId: activity._id,
      eventType,
      batchId,
    });
    return activity;
  } catch (error) {
    logger.error("Failed to log activity", {
      error: error.message,
      userId,
      eventType,
      batchId,
    });
    // Don't throw error to prevent interrupting the main transaction
    return null;
  }
};
