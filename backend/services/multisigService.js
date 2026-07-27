/**
 * Multi-Signature Approval Service
 */

const crypto = require("crypto");
const MultiSigApproval = require("../models/MultiSigApproval");
const Batch = require("../models/Batch");
const User = require("../models/User");
const { MULTISIG_ACTIONS, ROLES } = require("../constants/permissions");
const RBACService = require("./rbacService");

class MultisigService {
  static async createApprovalRequest(params) {
    const {
      batchId,
      actionType,
      initiatedBy,
      justification,
      evidence = [],
    } = params;
    const actionConfig = Object.values(MULTISIG_ACTIONS).find(
      (a) => a.action === actionType,
    );
    if (!actionConfig) throw new Error(`Invalid action type: ${actionType}`);

    const batch = await Batch.findOne({ batchId });
    if (!batch) throw new Error(`Batch not found: ${batchId}`);
    if (batch.hasPendingApproval && batch.hasPendingApproval())
      throw new Error("Batch already has a pending approval request");

    const existingRequest = await MultiSigApproval.hasPendingRequest(
      batchId,
      actionType,
    );
    if (existingRequest)
      throw new Error(
        "A pending approval request already exists for this action",
      );

    const initiator = await User.findById(initiatedBy);
    if (!initiator) throw new Error("Initiator not found");

    const { canInitiate, reason } = RBACService.canInitiateMultisigAction(
      initiator,
      actionType,
    );
    if (!canInitiate) throw new Error(`Not authorized to initiate: ${reason}`);

    const requestId = MultiSigApproval.generateRequestId();
    const expiresAt = new Date(
      Date.now() + actionConfig.expiresInHours * 60 * 60 * 1000,
    );

    const approval = new MultiSigApproval({
      requestId,
      actionType,
      batchId,
      initiatedBy,
      status: "pending",
      config: { requiredApprovals: actionConfig.requiredApprovals, expiresAt },
      justification,
      evidence,
      signatures: [],
      approvalCount: 0,
      rejectionCount: 0,
      auditTrail: [
        {
          action: "created",
          performedBy: initiatedBy,
          details: `Approval request created for ${actionType} on batch ${batchId}`,
        },
      ],
    });

    await approval.save();

    if (batch.setPendingApproval) {
      batch.setPendingApproval(requestId);
      await batch.save();
    }

    console.log(
      `[Multisig] Created approval request ${requestId} for ${actionType} on batch ${batchId}`,
    );
    return {
      requestId,
      status: "pending",
      requiredApprovals: actionConfig.requiredApprovals,
      expiresAt,
      batchId,
    };
  }

  static async addSignature(
    requestId,
    signer,
    decision,
    reason = "",
    ipAddress = "",
  ) {
    const approval = await MultiSigApproval.findOne({ requestId });
    if (!approval) throw new Error("Approval request not found");
    if (approval.status !== "pending")
      throw new Error(`Approval request is already ${approval.status}`);
    if (approval.isExpired) {
      approval.status = "expired";
      await approval.save();
      throw new Error("Approval request has expired");
    }

    const { canApprove, reason: checkReason } =
      RBACService.canUserApproveAction(signer, approval.actionType);
    if (!canApprove)
      throw new Error(`Not authorized to approve: ${checkReason}`);

    const existingSignature = approval.signatures.find(
      (s) => s.inspector.toString() === signer._id.toString(),
    );
    if (existingSignature)
      throw new Error("You have already signed this approval request");

    if (approval.initiatedBy.toString() === signer._id.toString())
      throw new Error("Initiator cannot approve their own request");

    const timestamp = Date.now();
    const signatureData = `${requestId}:${signer._id}:${decision}:${timestamp}`;
    const hmacSecret = process.env.MULTISIG_HMAC_SECRET;
    if (!hmacSecret) {
      throw new Error(
        "MULTISIG_HMAC_SECRET is not configured. Please set it in your .env file.",
      );
    }
    const signature = crypto
      .createHmac("sha256", hmacSecret)
      .update(signatureData)
      .digest("hex");

    await approval.addSignature({
      inspector: signer._id,
      certificationId: signer.inspectorCredentials?.certificationId || "",
      walletAddress: signer.walletAddress || "",
      decision,
      signature,
      reason,
      ipAddress,
      timestamp, // Store exact timestamp used to calculate HMAC
    });

    await User.findByIdAndUpdate(signer._id, {
      $inc: {
        "approvalStats.totalApprovals": decision === "approved" ? 1 : 0,
        "approvalStats.totalRejections": decision === "rejected" ? 1 : 0,
      },
      "approvalStats.lastApprovalAt": new Date(),
    });

    console.log(
      `[Multisig] Signature added to ${requestId} by ${signer.email}: ${decision}`,
    );

    if (approval.status === "approved")
      await this.executeApprovedAction(approval);

    return {
      requestId: approval.requestId,
      status: approval.status,
      approvalCount: approval.approvalCount,
      rejectionCount: approval.rejectionCount,
      requiredApprovals: approval.config.requiredApprovals,
    };
  }

  static async executeApprovedAction(approval) {
    if (approval.status !== "approved")
      throw new Error("Action is not approved");
    const batch = await Batch.findOne({ batchId: approval.batchId });
    if (!batch) throw new Error("Batch not found");

    let result = {};

    switch (approval.actionType) {
      case "batch_recall":
        if (batch.executeRecall) {
          batch.executeRecall({
            recalledBy: approval.initiatedBy.toString(),
            reason: approval.justification,
            approvalRequestId: approval.requestId,
            txHash: null,
          });
          result = { recalled: true, batchId: batch.batchId };
        }
        break;
      case "batch_contaminated":
        if (batch.markContaminated) {
          batch.markContaminated({
            reportedBy: approval.initiatedBy.toString(),
            approvalRequestId: approval.requestId,
            notes: approval.justification,
            contaminationType: "unknown",
            severity: "high",
          });
          result = { contaminated: true, batchId: batch.batchId };
        }
        break;
      case "batch_destroy":
        if (batch.authorizeDestruction) {
          batch.authorizeDestruction({
            authorizedBy: approval.initiatedBy.toString(),
            approvalRequestId: approval.requestId,
            notes: approval.justification,
          });
          result = { destructionAuthorized: true, batchId: batch.batchId };
        }
        break;
      case "batch_quality_check":
        if (!batch.lifecycle)
          batch.lifecycle = { currentStage: "Registered", stageHistory: [] };
        batch.lifecycle.currentStage = "Quality Checked";
        batch.lifecycle.stageHistory.push({
          stage: "Quality Checked",
          timestamp: new Date(),
          updatedBy: "Multisig System",
          notes: `Quality Check Approved: ${approval.justification}`,
        });
        result = { qualityChecked: true, batchId: batch.batchId };
        break;
      default:
        throw new Error(`Unknown action type: ${approval.actionType}`);
    }

    if (batch.addApprovalHistory) {
      batch.addApprovalHistory({
        requestId: approval.requestId,
        actionType: approval.actionType,
        status: "approved",
        resolvedAt: new Date(),
        approvalCount: approval.approvalCount,
        rejectionCount: approval.rejectionCount,
      });
    }
    await batch.save();
    await approval.markExecuted(approval.initiatedBy, null, result);
    console.log(
      `[Multisig] Executed approved action ${approval.actionType} for batch ${batch.batchId}`,
    );
    return result;
  }

  static async cancelRequest(requestId, cancelledBy, reason = "") {
    const approval = await MultiSigApproval.findOne({ requestId });
    if (!approval) throw new Error("Approval request not found");
    const canceller = await User.findById(cancelledBy);
    if (!canceller) throw new Error("User not found");
    const isInitiator = approval.initiatedBy.toString() === cancelledBy;
    const isAdmin =
      canceller.role === ROLES.ADMIN || canceller.role === ROLES.SUPER_ADMIN;
    if (!isInitiator && !isAdmin)
      throw new Error("Not authorized to cancel this request");
    await approval.cancel(cancelledBy, reason);
    const batch = await Batch.findOne({ batchId: approval.batchId });
    if (batch) {
      if (batch.clearPendingApproval) batch.clearPendingApproval();
      if (batch.addApprovalHistory)
        batch.addApprovalHistory({
          requestId: approval.requestId,
          actionType: approval.actionType,
          status: "cancelled",
          resolvedAt: new Date(),
        });
      await batch.save();
    }
    console.log(`[Multisig] Cancelled approval request ${requestId}`);
    return { requestId, status: "cancelled", reason };
  }

  static async getRequestDetails(requestId) {
    const approval = await MultiSigApproval.findOne({ requestId })
      .populate("initiatedBy", "name email role")
      .populate(
        "signatures.inspector",
        "name email role inspectorCredentials.certificationId",
      );
    if (!approval) throw new Error("Approval request not found");
    return approval.toObject();
  }

  static async getPendingRequests(filters = {}) {
    const query = {
      status: "pending",
      "config.expiresAt": { $gt: new Date() },
    };
    if (filters.batchId) query.batchId = filters.batchId;
    if (filters.actionType) query.actionType = filters.actionType;
    return MultiSigApproval.find(query)
      .populate("initiatedBy", "name email role")
      .sort({ createdAt: -1 });
  }

  static async getRequestsNeedingSignature(inspectorId) {
    return MultiSigApproval.findRequiringSignature(inspectorId);
  }

  static async getBatchApprovalHistory(batchId) {
    return MultiSigApproval.find({ batchId })
      .populate("initiatedBy", "name email role")
      .populate("signatures.inspector", "name email role")
      .sort({ createdAt: -1 });
  }

  static async getStatistics() {
    const stats = await MultiSigApproval.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const result = {
      pending: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
      cancelled: 0,
      executed: 0,
    };
    stats.forEach((stat) => {
      result[stat._id] = stat.count;
    });
    return result;
  }
}

module.exports = MultisigService;
