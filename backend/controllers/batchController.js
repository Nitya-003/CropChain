const Batch = require("../models/Batch");
const Counter = require("../models/Counter");
const mongoose = require("mongoose");
const apiResponse = require("../utils/apiResponse");
const { isAdminRole } = require("../constants/permissions");
const STAGES = require("../constants/stages");
const {
  LIFECYCLE_STAGES,
  SUPPLY_CHAIN_TO_LIFECYCLE,
  isLifecycleAtLeast,
} = require('../constants/stageMapping');
const logger = require('../utils/logger');
const { emitToBatchRoom } = require('../services/socketService');
const activityService = require('../services/activityService');
const batchService = require('../services/batchService');
const QRCode = require('qrcode');
const { calculateUpdateHash } = require('../utils/cryptography');
const { 
    createBatchSchema, 
    updateBatchSchema, 
    updateBatchStatusSchema, 
    recordIoTDataSchema 
} = require('../validations/batchSchema');

const escapeRegex = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const CSV_FORMULA_PREFIX = /^[=+\-@]/;

const escapeCsvCell = (value) => {
  if (value == null) return '""';
  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  if (CSV_FORMULA_PREFIX.test(escaped)) {
    return `"\t${escaped}"`;
  }
  return `"${escaped}"`;
};

const buildSafeSearchFilter = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return { $regex: escapeRegex(trimmedValue), $options: "i" };
};

/**
 * Generate a unique batch ID using MongoDB counter
 */
const generateBatchId = async (session) => {
  const counter = await Counter.findOneAndUpdate(
    { name: "batchId" },
    { $inc: { seq: 1 } },
    { new: true, session, upsert: true },
  );
  return `BATCH${counter.seq.toString().padStart(6, "0")}`;
};

/**
 * Generate QR code data for a batch
 * NOTE: Must stay in sync with the URL format used in services/batchService.js.
 * The frontend route is /track-batch (a query-param page), not /track/[batchId].
 */
const generateQRCode = async (batchId) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const trackingUrl = `${frontendUrl}/track-batch?id=${encodeURIComponent(batchId)}`;
    return await QRCode.toDataURL(trackingUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: "#22c55e",
        light: "#ffffff",
      },
    });
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    return "";
  }
};

/**
 * Create a new batch
 * @route POST /api/batches
 * @access Private (Farmer only)
 */
exports.createBatch = async (req, res) => {
    try {
        const validationResult = createBatchSchema.safeParse(req.body);
        if (!validationResult.success) {
            const issues = validationResult.error.issues || validationResult.error.errors || [];
            const details = issues.map(err => err.message);
            return res.status(400).json(apiResponse.errorResponse('Validation failed', 'VALIDATION_ERROR', 400, details));
        }

        const validatedData = validationResult.data;
        const result = await batchService.createBatch(validatedData, req.user);
        
        if (!result.success) {
            return res.status(500).json(apiResponse.errorResponse(result.error, 'BATCH_CREATION_ERROR', 500));
        }

        res.status(201).json(apiResponse.successResponse({ batch: result.batch }, 'Batch created successfully', 201));
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json(apiResponse.errorResponse('Batch with this ID already exists', 'DUPLICATE_BATCH_ERROR', 409));
        }
        logger.error('Error creating batch', { error: error.message, stack: error.stack });
        res.status(500).json(apiResponse.errorResponse('Failed to create batch', 'BATCH_CREATION_ERROR', 500));
    }
};

/**
 * Get a single batch by batchId
 * @route GET /api/batches/:batchId
 * @access Public
 */
exports.getBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const batch = await Batch.findOne({ batchId }).lean();

    if (!batch) {
      logger.warn("Batch not found", { batchId, ip: req.ip });
      const response = apiResponse.notFoundResponse("Batch", `ID: ${batchId}`);
      return res.status(404).json(response);
    }

    if (batch.isRecalled) {
      logger.warn("Recalled batch viewed", { batchId, ip: req.ip });
    }

    // Flatten iotData to top-level for frontend compatibility
    if (batch.iotData) {
      batch.currentTemperature = batch.iotData.currentTemperature ?? null;
      batch.currentHumidity = batch.iotData.currentHumidity ?? null;
      batch.isSpoiled = batch.iotData.isSpoiled ?? false;
      batch.iotTimestamp = batch.iotData.lastUpdated ?? null;
      delete batch.iotData;
    }

    const response = apiResponse.successResponse(
      { batch },
      "Batch retrieved successfully",
    );
    res.json(response);
  } catch (error) {
    logger.error("Error fetching batch", {
      error: error.message,
      stack: error.stack,
    });
    const response = apiResponse.errorResponse(
      "Failed to fetch batch",
      "BATCH_FETCH_ERROR",
      500,
    );
    res.status(500).json(response);
  }
};

/**
 * Update a batch
 * @route PUT /api/batches/:batchId
 * @access Private (Batch owner + stage transition authorized)
 */
exports.updateBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const validationResult = updateBatchSchema.safeParse(req.body);
        
        if (!validationResult.success) {
            const issues = validationResult.error.issues || validationResult.error.errors || [];
            const details = issues.map(err => err.message);
            return res.status(400).json(apiResponse.errorResponse('Validation failed', 'VALIDATION_ERROR', 400, details));
        }

        const validatedData = validationResult.data;
        const result = await batchService.updateBatch(batchId, validatedData, req.user);

        if (!result.success) {
            const statusCode = result.statusCode || 500;
            const response = statusCode === 404
                ? apiResponse.notFoundResponse('Batch', `ID: ${batchId}`)
                : apiResponse.errorResponse(result.error, 'BATCH_UPDATE_ERROR', statusCode);
            return res.status(statusCode).json(response);
        }

        res.json(apiResponse.successResponse({ batch: result.batch }, 'Batch updated successfully'));
    } catch (error) {
        logger.error('Error updating batch', { error: error.message, stack: error.stack });
        res.status(500).json(apiResponse.errorResponse('Failed to update batch', 'BATCH_UPDATE_ERROR', 500));
    }
};

/**
 * Recall a batch (admin only)
 * @route POST /api/batches/:batchId/recall
 * @access Private (Admin only)
 */
exports.recallBatch = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!req.user || !isAdminRole(req.user.role)) {
      return res
        .status(403)
        .json(
          apiResponse.errorResponse(
            "Access denied. Admin privileges required.",
            "FORBIDDEN",
            403,
          ),
        );
    }

    const batch = await Batch.findOneAndUpdate(
      { batchId, isRecalled: false },
      { $set: { isRecalled: true } },
      { new: true },
    );

    if (!batch) {
      const existing = await Batch.findOne({ batchId });
      if (!existing) {
        return res
          .status(404)
          .json(apiResponse.notFoundResponse("Batch", `ID: ${batchId}`));
      }
      return res
        .status(400)
        .json(
          apiResponse.errorResponse(
            "Batch already recalled",
            "BATCH_ALREADY_RECALLED",
            400,
          ),
        );
    }

    logger.warn("Batch recalled", {
      batchId,
      adminId: req.user?.id,
      ip: req.ip,
    });

    await activityService.logActivity({
      userId: req.user.id || req.user._id,
      userRole: req.user.role,
      eventType: "batch_recalled",
      batchId,
      description: `Batch recalled by ${req.user.role}`,
      metadata: {
        recalledBy: req.user.email || req.user.name,
      },
    });

    res.json({
      success: true,
      message: "Batch recalled successfully",
      recalledBy: req.user?.email,
      recalledAt: new Date().toISOString(),
      batch,
    });
  } catch (error) {
    logger.error("Error recalling batch", {
      error: error.message,
      stack: error.stack,
    });
    res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Failed to recall batch",
          "BATCH_RECALL_ERROR",
          500,
        ),
      );
  }
};

// Helper function to simulate blockchain hash (replace with actual blockchain integration)
const simulateBlockchainHash = (data) => {
  const crypto = require("crypto");
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(data) + Date.now() + crypto.randomBytes(16).toString("hex"))
    .digest("hex");
};

exports.getBatches = async (req, res) => {
  try {
    const {
      search,
      batchId,
      farmerName,
      cropType,
      status,
      currentStage,
      stage,
      startDate,
      endDate,
      dateFrom,
      dateTo,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    // 1. Unified Search parameter (regex matches on batchId, cropType, farmerName)
    if (search) {
      const escaped = escapeRegex(search.trim());
      query.$or = [
        { batchId: { $regex: escaped, $options: "i" } },
        { cropType: { $regex: escaped, $options: "i" } },
        { farmerName: { $regex: escaped, $options: "i" } },
      ];
    }

    // 2. Individual parameters (from existing & test requirements)
    const batchIdFilter = buildSafeSearchFilter(batchId);
    if (batchIdFilter) {
      query.batchId = batchIdFilter;
    }
    const farmerNameFilter = buildSafeSearchFilter(farmerName);
    if (farmerNameFilter) {
      query.farmerName = farmerNameFilter;
    }
    if (cropType) {
      query.cropType = cropType.toLowerCase();
    }

    if (status) {
      query.status = status;
    }

    // Handle both 'currentStage' (existing) and 'stage' (new)
    const targetStage = currentStage || stage;
    if (targetStage) {
      const normalizedStage = targetStage.toLowerCase();
      if (STAGES.includes(normalizedStage)) {
        query.currentStage = normalizedStage;
      }
    }

    // Handle date range (both startDate/endDate and dateFrom/dateTo)
    const start = startDate || dateFrom;
    const end = endDate || dateTo;
    if (start || end) {
      query.createdAt = {};
      if (start) {
        query.createdAt.$gte = new Date(start);
      }
      if (end) {
        query.createdAt.$lte = new Date(end);
      }
    }

    const MAX_LIMIT = 100;
    const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
    const limitNumber = Math.min(
      Math.max(parseInt(limit, 10) || 10, 1),
      MAX_LIMIT,
    );
    const skip = (pageNumber - 1) * limitNumber;

    const sort = {};
    sort[sortBy] = sortOrder.toLowerCase() === "asc" ? 1 : -1;

    // Use lean() for read-only queries to skip Mongoose document hydration
    const batches = await Batch.find(query)
      .lean()
      .sort(sort)
      .skip(skip)
      .limit(limitNumber);

    // Flatten iotData to top-level for frontend compatibility
    for (const batch of batches) {
      if (batch.iotData) {
        batch.currentTemperature = batch.iotData.currentTemperature ?? null;
        batch.currentHumidity = batch.iotData.currentHumidity ?? null;
        batch.isSpoiled = batch.iotData.isSpoiled ?? false;
        batch.iotTimestamp = batch.iotData.lastUpdated ?? null;
        delete batch.iotData;
      }
    }

    const [totalItems, statsAggregation] = await Promise.all([
      Batch.countDocuments(query),
      Batch.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalFarmers: { $addToSet: "$farmerId" },
            totalQuantity: { $sum: { $ifNull: ["$quantity", 0] } },
          },
        },
      ]),
    ]);

    const aggregateStats = statsAggregation[0] || {
      totalFarmers: [],
      totalQuantity: 0,
    };

    res.json(
      apiResponse.successResponse(
        {
          batches,
          stats: {
            totalBatches: totalItems,
            totalFarmers: aggregateStats.totalFarmers.length,
            totalQuantity: aggregateStats.totalQuantity,
            recentBatches: batches.slice(0, 5),
          },
          pagination: {
            totalItems,
            currentPage: pageNumber,
            totalPages: Math.ceil(totalItems / limitNumber),
            limit: limitNumber,
          },
        },
        "Batches retrieved successfully",
      ),
    );
  } catch (err) {
    res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Failed to fetch batches",
          "FETCH_ERROR",
          500,
          err.message,
        ),
      );
  }
};

/**
 * Get all batches with filtering, pagination, and sorting
 * @route GET /api/batches
 * @access Public
 */
exports.getAllBatches = exports.getBatches; // Alias for consistency

/**
 * Update the status of a batch (Active/Flagged/Inactive)
 * Only accessible by admin users
 * @route PATCH /api/batches/:batchId/status
 * @access Private (Admin only)
 */
exports.updateBatchStatus = async (req, res) => {
    try {
        if (!req.user || !isAdminRole(req.user.role)) {
            return res.status(403).json(apiResponse.errorResponse('Access denied. Admin privileges required.', 'FORBIDDEN', 403));
        }

        const { batchId } = req.params;
        const validationResult = updateBatchStatusSchema.safeParse(req.body);
        
        if (!validationResult.success) {
            const details = validationResult.error.errors.map(err => err.message);
            return res.status(400).json(apiResponse.errorResponse('Validation failed', 'VALIDATION_ERROR', 400, details));
        }
        
        const { status } = validationResult.data;
        
        const batch = await Batch.findOneAndUpdate(
            { batchId },
            { $set: { status } },
            { new: true }
        );

        if (!batch) {
            return res.status(404).json(apiResponse.notFoundResponse('Batch', `ID: ${batchId}`));
        }

        logger.info('Batch status changed', { batchId, status, userId: req.user.id, role: req.user.role });

        await activityService.logActivity({
            userId: req.user.id || req.user._id,
            userRole: req.user.role,
            eventType: 'batch_status_updated',
            batchId,
            description: `Batch status updated to ${status}`,
            metadata: {
                status,
                updatedBy: req.user.email || req.user.name,
            },
        });

        emitToBatchRoom(batchId, 'batch:statusChanged', {
            batchId,
            status,
            updatedBy: req.user.email || req.user.name,
            timestamp: new Date().toISOString(),
        });

        res.json(apiResponse.successResponse({ batch }, 'Batch status updated successfully'));
    } catch (err) {
        logger.error('Error updating batch status', { error: err.message, stack: err.stack });
        res.status(500).json(apiResponse.errorResponse('Failed to update batch status', 'BATCH_STATUS_UPDATE_ERROR', 500));
    }
};

exports.exportBatch = async (req, res) => {
  try {
    const { batchId } = req.params;
    const { format = "pdf" } = req.query;

    const batch = await Batch.findOne({ batchId }).lean();
    if (!batch) {
      return res
        .status(404)
        .json(
          apiResponse.errorResponse("Batch not found", "BATCH_NOT_FOUND", 404),
        );
    }

    if (batch.iotData) {
      batch.currentTemperature = batch.iotData.currentTemperature ?? null;
      batch.currentHumidity = batch.iotData.currentHumidity ?? null;
      batch.isSpoiled = batch.iotData.isSpoiled ?? false;
      batch.iotTimestamp = batch.iotData.lastUpdated ?? null;
      delete batch.iotData;
    }

    const sanitizeCSV = (str) => {
      if (!str) return "";
      const s = String(str);
      if (/^[=+\-@\t\r]/.test(s)) {
        return "'" + s;
      }
      return s;
    };

    if (format === "csv") {
      const csvData = [
        "Field,Value",
        `Batch ID,${escapeCsvCell(batch.batchId)}`,
        `Crop Type,${escapeCsvCell(batch.cropType)}`,
        `Quantity,${escapeCsvCell(batch.quantity + " kg")}`,
        `Harvest Date,${escapeCsvCell(batch.harvestDate || "N/A")}`,
        `Origin,${escapeCsvCell(batch.origin)}`,
        `Farmer,${escapeCsvCell(batch.farmerName)}`,
        `Current Stage,${escapeCsvCell(batch.currentStage)}`,
        `Status,${escapeCsvCell(batch.isSpoiled ? "Spoiled" : "Active")}`,
        `Batch ID,${sanitizeCSV(batch.batchId)}`,
        `Crop Type,${sanitizeCSV(batch.cropType)}`,
        `Quantity,${batch.quantity} kg`,
        `Harvest Date,${batch.harvestDate || "N/A"}`,
        `Origin,${sanitizeCSV(batch.origin)}`,
        `Farmer,${sanitizeCSV(batch.farmerName)}`,
        `Current Stage,${sanitizeCSV(batch.currentStage)}`,
        `Status,${batch.isSpoiled ? "Spoiled" : "Active"}`,
      ];

      if (batch.updates?.length) {
        csvData.push("");
        csvData.push("Timeline");
        csvData.push("Stage,Actor,Location,Date,Notes");
        batch.updates.forEach((u) => {
          csvData.push(
            [
              escapeCsvCell(u.stage),
              escapeCsvCell(u.actor),
              escapeCsvCell(u.location),
              escapeCsvCell(u.timestamp),
              escapeCsvCell(u.notes),
            ].join(","),
          );
          const stage = sanitizeCSV(u.stage || "").replace(/"/g, '""');
          const actor = sanitizeCSV(u.actor || "").replace(/"/g, '""');
          const location = sanitizeCSV(u.location || "").replace(/"/g, '""');
          const timestamp = sanitizeCSV(u.timestamp || "").replace(/"/g, '""');
          const notes = sanitizeCSV(u.notes || "").replace(/"/g, '""');
          csvData.push(
            `"${stage}","${actor}","${location}","${timestamp}","${notes}"`,
          );
        });
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="batch-${batchId}.csv"`,
      );
      return res.send(csvData.join("\n"));
    }

    // PDF export
    const pdfService = require("../services/pdfService");
    const pdfBuffer = await pdfService.generateBatchJourneyPDF(batch);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="batch-${batchId}-journey.pdf"`,
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("Export failed:", error);
    return res
      .status(500)
      .json(apiResponse.errorResponse("Export failed", "EXPORT_ERROR", 500));
  }
};

const spoilageDetectionService = require("../services/spoilageDetectionService");

/**
 * Record IoT sensor data for a batch
 * @route POST /api/batches/:batchId/iot
 */
exports.recordIoTData = async (req, res) => {
    try {
        const { batchId } = req.params;
        
        const validationResult = recordIoTDataSchema.safeParse(req.body);
        if (!validationResult.success) {
            const details = validationResult.error.errors.map(err => err.message);
            return res.status(400).json(apiResponse.errorResponse('Validation failed', 'VALIDATION_ERROR', 400, details));
        }
        
        const { temperature, humidity } = validationResult.data;

        const batch = await spoilageDetectionService.recordIoTData(batchId, temperature, humidity);

        await activityService.logActivity({
            userId: req.user.id || req.user._id,
            userRole: req.user.role,
            eventType: 'iot_data_recorded',
            batchId,
            description: `IoT telemetry recorded: Temp ${temperature}°C, Humidity ${humidity}%`,
            metadata: {
                temperature,
                humidity,
                isSpoiled: batch.iotData.isSpoiled
            }
        });

        res.json(
            apiResponse.successResponse({
                batchId: batch.batchId,
                currentTemperature: batch.iotData.currentTemperature,
                currentHumidity: batch.iotData.currentHumidity,
                isSpoiled: batch.iotData.isSpoiled,
                lastUpdated: batch.iotData.lastUpdated,
            }, 'IoT data recorded successfully')
        );
    } catch (error) {
        if (error.statusCode === 404) {
            return res.status(404).json(
                apiResponse.errorResponse('Batch not found', 'BATCH_NOT_FOUND', 404)
            );
        }
        console.error('Error recording IoT data:', error);
        res.status(500).json(
            apiResponse.errorResponse('Failed to record IoT data', 'IOT_RECORD_ERROR', 500)
        );
    }
};

/**
 * Get IoT sensor data for a batch
 * @route GET /api/batches/:batchId/iot
 */
exports.getIoTData = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!batchId) {
      return res
        .status(400)
        .json(
          apiResponse.errorResponse(
            "Batch ID is required",
            "MISSING_BATCH_ID",
            400,
          ),
        );
    }

    const data = await spoilageDetectionService.getIoTData(batchId);

    res.json(
      apiResponse.successResponse(data, "IoT data retrieved successfully"),
    );
  } catch (error) {
    if (error.statusCode === 404) {
      return res
        .status(404)
        .json(
          apiResponse.errorResponse("Batch not found", "BATCH_NOT_FOUND", 404),
        );
    }
    console.error("Error getting IoT data:", error);
    res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Failed to retrieve IoT data",
          "IOT_DATA_ERROR",
          500,
        ),
      );
  }
};
