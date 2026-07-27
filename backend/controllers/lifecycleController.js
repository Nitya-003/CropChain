const Batch = require('../models/Batch');
const apiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');
const activityService = require('../services/activityService');
const { isAdminRole } = require('../constants/permissions');
const {
  LIFECYCLE_STAGES,
  LIFECYCLE_TO_SUPPLY_CHAIN,
  isSupplyChainAtLeast,
} = require('../constants/stageMapping');

// Stage completion percentage mapping
const STAGE_COMPLETION = {
  Registered: 17,
  Growing: 33,
  Harvested: 50,
  "Quality Checked": 67,
  Transported: 83,
  Delivered: 100,
};

// Check if role is authorized to transition to the target stage
const isAuthorizedForStage = (role, targetStage) => {
  const isAdmin = role === "admin" || role === "super_admin";
  if (isAdmin) return true;

  if (role === "farmer") {
    return targetStage === "Growing" || targetStage === "Harvested";
  }
  if (role === "transporter" || role === "mandi") {
    return targetStage === "Transported";
  }
  if (role === "retailer") {
    return targetStage === "Delivered";
  }
  if (role === "quality_inspector") {
    return targetStage === "Quality Checked";
  }
  return false;
};

/**
 * Get crop lifecycle progress
 * @route GET /api/batches/:id/lifecycle
 */
exports.getLifecycle = async (req, res) => {
  try {
    const { id } = req.params;

    // Find by batchId or mongoose _id
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { batchId: id };
    const batch = await Batch.findOne(query);

    if (!batch) {
      return res.status(404).json(apiResponse.notFoundResponse("Batch", id));
    }

    // Initialize lifecycle if not present
    if (!batch.lifecycle || !batch.lifecycle.currentStage) {
      batch.lifecycle = {
        currentStage: "Registered",
        stageHistory: [
          {
            stage: "Registered",
            timestamp: batch.createdAt || new Date(),
            updatedBy: batch.farmerName || "System",
            notes: "Lifecycle has just started.",
          },
        ],
      };
      await batch.save();
    }

    const currentStage = batch.lifecycle.currentStage;
    const completionPercentage = STAGE_COMPLETION[currentStage] || 0;

    return res.json({
      success: true,
      data: {
        currentStage,
        stageHistory: batch.lifecycle.stageHistory,
        completionPercentage,
      },
    });
  } catch (error) {
    logger.error("Error fetching lifecycle", { error: error.message });
    return res
      .status(500)
      .json(
        apiResponse.errorResponse(
          "Failed to fetch lifecycle",
          "LIFECYCLE_FETCH_ERROR",
          500,
        ),
      );
  }
};

/**
 * Update crop lifecycle stage
 * @route PATCH /api/batches/:id/lifecycle
 */
exports.updateLifecycle = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, notes } = req.body;

    if (!stage) {
      return res.status(400).json(apiResponse.errorResponse("Stage is required", "VALIDATION_ERROR", 400));
    }

    if (!LIFECYCLE_STAGES.includes(stage)) {
      return res.status(400).json(apiResponse.errorResponse(
        `Invalid stage. Must be one of: ${LIFECYCLE_STAGES.join(", ")}`,
        "INVALID_STAGE",
        400
      ));
    }

    // Find by batchId or mongoose _id
    const query = id.match(/^[0-9a-fA-F]{24}$/) ? { _id: id } : { batchId: id };
    const batch = await Batch.findOne(query);

    if (!batch) {
      return res.status(404).json(apiResponse.notFoundResponse("Batch", id));
    }

    // Initialize lifecycle if not present
    if (!batch.lifecycle || !batch.lifecycle.currentStage) {
      batch.lifecycle = {
        currentStage: "Registered",
        stageHistory: [{
          stage: "Registered",
          timestamp: batch.createdAt || new Date(),
          updatedBy: batch.farmerName || "System",
          notes: "Lifecycle has just started."
        }]
      };
    }

    const currentStage = batch.lifecycle.currentStage;

    // ---- Ownership / participation check ----
    if (!isAdminRole(req.user.role)) {
      const userId = (req.user.id || req.user._id)?.toString().trim().toLowerCase();
      const batchFarmerId = batch.farmerId?.toString().trim().toLowerCase();
      const isOwner = userId === batchFarmerId;

      if (!isOwner) {
        logger.warn("Lifecycle update rejected: user does not own this batch", {
          userId,
          role: req.user.role,
          batchId: batch.batchId,
          batchOwner: batch.farmerId
        });
        return res.status(403).json(apiResponse.errorResponse(
          "You are not authorized to update the lifecycle of this batch.",
          "FORBIDDEN",
          403
        ));
      }
    }
    // 1. Prevent duplicate stage updates
    if (currentStage === stage) {
      return res.status(400).json(apiResponse.errorResponse(
        `Batch is already in the '${stage}' stage.`,
        "DUPLICATE_STAGE",
        400
      ));
    }

    // 2. Validate transitions (only allow step-by-step sequential changes)
    const currentIndex = LIFECYCLE_STAGES.indexOf(currentStage);
    const newIndex = LIFECYCLE_STAGES.indexOf(stage);

    if (newIndex < currentIndex) {
      return res.status(400).json(apiResponse.errorResponse(
        "Reverting to previous stages is not allowed.",
        "INVALID_TRANSITION",
        400
      ));
    }

    if (newIndex > currentIndex + 1) {
      return res.status(400).json(apiResponse.errorResponse(
        `Skipping stages is not allowed. Must transition to '${LIFECYCLE_STAGES[currentIndex + 1]}' next.`,
        "STAGE_SKIPPED",
        400
      ));
    }

    // 3. Authorization check
    const userRole = req.user.role;
    if (!isAuthorizedForStage(userRole, stage)) {
      return res.status(403).json(apiResponse.errorResponse(
        `Role '${userRole}' is not authorized to update lifecycle to '${stage}'.`,
        "FORBIDDEN",
        403
      ));
    }

    // 4. Multisig enforcement for Quality Checked
    if (stage === "Quality Checked") {
      return res.status(403).json(apiResponse.errorResponse(
        "Advancing to 'Quality Checked' requires a multi-signature approval request via the /api/approvals/quality-check endpoint.",
        "FORBIDDEN_MULTISIG_REQUIRED",
        403
      ));
    }

    // 5. Cross-validation with supply chain stage
    const minSupplyChainStage = LIFECYCLE_TO_SUPPLY_CHAIN[stage];
    if (minSupplyChainStage && !isSupplyChainAtLeast(batch.currentStage, minSupplyChainStage)) {
      const supplyChainLabel = batch.currentStage || "farmer";
      return res.status(400).json(apiResponse.errorResponse(
        `Cannot advance lifecycle to '${stage}' because the batch supply chain is still at '${supplyChainLabel}'. ` +
        `The supply chain must reach at least '${minSupplyChainStage}' before the lifecycle can advance to '${stage}'.`,
        "SUPPLY_CHAIN_PREREQUISITE_NOT_MET",
        400
      ));
    }

    // Apply update
    batch.lifecycle.currentStage = stage;
    batch.lifecycle.stageHistory.push({
      stage,
      timestamp: new Date(),
      updatedBy: req.user.name || req.user.email || "Authorized User",
      notes: notes || ""
    });

    await batch.save();

    // Log activity
    await activityService.logActivity({
      userId: req.user.id || req.user._id,
      userRole: req.user.role,
      eventType: "lifecycle_updated",
      batchId: batch.batchId,
      description: `Lifecycle stage updated to ${stage}`,
      metadata: {
        stage,
        updatedBy: req.user.name || req.user.email,
        notes
      }
    });

    return res.json({
      success: true,
      message: "Lifecycle stage updated successfully",
      data: {
        currentStage: batch.lifecycle.currentStage,
        stageHistory: batch.lifecycle.stageHistory,
        completionPercentage: STAGE_COMPLETION[stage]
      }
    });
  } catch (error) {
    logger.error("Error updating lifecycle", { error: error.message });
    return res.status(500).json(apiResponse.errorResponse("Failed to update lifecycle", "LIFECYCLE_UPDATE_ERROR", 500));
  }
};
