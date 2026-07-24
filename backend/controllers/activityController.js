const Activity = require("../models/Activity");
const Batch = require("../models/Batch");
const apiResponse = require("../utils/apiResponse");
const { isAdminRole, ROLES } = require("../constants/permissions");
const logger = require("../utils/logger");

/**
 * Helper to build role-based filters for activity queries
 * @param {Object} user - The authenticated user object
 * @returns {Promise<Object>} Mongoose query filter object
 */
const buildRoleFeedFilter = async (user) => {
  // Admins can see everything
  if (isAdminRole(user.role)) {
    return {};
  }

  const userId = String(user.id || user._id);
  const userName = user.name;

  if (user.role === ROLES.FARMER) {
    // Farmers see activities for batches they created/own, or activities they performed
    const farmerId = user.farmerId || userId;
    const myBatches = await Batch.find({ farmerId }).select("batchId").lean();
    const batchIds = myBatches.map((b) => b.batchId);
    return {
      $or: [{ batchId: { $in: batchIds } }, { userId }],
    };
  }

  if (user.role === ROLES.TRANSPORTER) {
    // Distributors (Transporters) see activities for shipments/batches they updated
    const myUpdatedBatches = await Batch.find({
      updates: {
        $elemMatch: {
          stage: "transport",
          actor: userName,
        },
      },
    })
      .select("batchId")
      .lean();
    const batchIds = myUpdatedBatches.map((b) => b.batchId);
    return {
      $or: [{ batchId: { $in: batchIds } }, { userId }],
    };
  }

  if (user.role === ROLES.RETAILER) {
    // Retailers see activities for batches they received or updated
    const myReceivedBatches = await Batch.find({
      updates: {
        $elemMatch: {
          stage: "retailer",
          actor: userName,
        },
      },
    })
      .select("batchId")
      .lean();
    const batchIds = myReceivedBatches.map((b) => b.batchId);
    return {
      $or: [{ batchId: { $in: batchIds } }, { userId }],
    };
  }

  // Default fallback: only see their own activities
  return { userId };
};

/**
 * Get all activities (Admin only)
 * @route GET /api/activities
 */
exports.getActivities = async (req, res) => {
  try {
    if (!isAdminRole(req.user.role)) {
      return res
        .status(403)
        .json(apiResponse.forbiddenResponse("Admin access required"));
    }

    const {
      role,
      eventType,
      batchId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;
    const query = {};

    if (role) query.userRole = role;
    if (eventType) query.eventType = eventType;
    if (batchId) query.batchId = batchId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const MAX_LIMIT = 100;
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      MAX_LIMIT,
    );
    const skip = (pageNumber - 1) * limitNumber;

    const activities = await Activity.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const totalItems = await Activity.countDocuments(query);

    res.json(
      apiResponse.successResponse(
        {
          activities,
          pagination: {
            totalItems,
            currentPage: pageNumber,
            totalPages: Math.ceil(totalItems / limitNumber),
            limit: limitNumber,
          },
        },
        "Activities retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error fetching activities", { error: error.message });
    res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Failed to fetch activities",
          "ACTIVITY_FETCH_ERROR",
          500,
        ),
      );
  }
};

/**
 * Get personalized activity feed (Role-based)
 * @route GET /api/activities/feed
 */
exports.getActivityFeed = async (req, res) => {
  try {
    const roleFilter = await buildRoleFeedFilter(req.user);
    const {
      eventType,
      batchId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const query = { ...roleFilter };

    if (eventType) query.eventType = eventType;
    if (batchId) query.batchId = batchId;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const MAX_LIMIT = 100;
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      MAX_LIMIT,
    );
    const skip = (pageNumber - 1) * limitNumber;

    const activities = await Activity.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    const totalItems = await Activity.countDocuments(query);

    res.json(
      apiResponse.successResponse(
        {
          activities,
          pagination: {
            totalItems,
            currentPage: pageNumber,
            totalPages: Math.ceil(totalItems / limitNumber),
            limit: limitNumber,
          },
        },
        "Activity feed retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error fetching activity feed", { error: error.message });
    res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Failed to fetch activity feed",
          "FEED_FETCH_ERROR",
          500,
        ),
      );
  }
};

/**
 * Get single activity by ID
 * @route GET /api/activities/:id
 */
exports.getActivityById = async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id).lean();
    if (!activity) {
      return res
        .status(404)
        .json(apiResponse.notFoundResponse("Activity", req.params.id));
    }

    // Authorization check
    const roleFilter = await buildRoleFeedFilter(req.user);
    const query = { _id: req.params.id, ...roleFilter };
    const authorizedActivity = await Activity.findOne(query).lean();

    if (!authorizedActivity) {
      return res
        .status(403)
        .json(
          apiResponse.forbiddenResponse(
            "You are not authorized to view this activity",
          ),
        );
    }

    res.json(
      apiResponse.successResponse(
        { activity },
        "Activity retrieved successfully",
      ),
    );
  } catch (error) {
    logger.error("Error fetching activity by ID", { error: error.message });
    res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Failed to fetch activity",
          "ACTIVITY_BY_ID_ERROR",
          500,
        ),
      );
  }
};
