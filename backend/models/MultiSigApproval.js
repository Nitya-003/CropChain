/**
 * Multi-Signature Approval Model
 */

const mongoose = require("mongoose");
const { MULTISIG_ACTIONS } = require("../constants/permissions");

const signatureSchema = new mongoose.Schema(
  {
    inspector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    inspectorCertificationId: { type: String, required: true },
    walletAddress: { type: String, lowercase: true, trim: true },
    decision: { type: String, enum: ["approved", "rejected"], required: true },
    signedAt: { type: Date, default: Date.now },
    signature: { type: String, required: true },
    reason: { type: String, maxlength: 1000 },
    ipAddress: { type: String },
  },
  { _id: true },
);

const auditEntrySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    timestamp: { type: Date, default: Date.now },
    details: { type: String },
    ipAddress: { type: String },
  },
  { _id: true },
);

const multiSigApprovalSchema = new mongoose.Schema(
  {
    requestId: { type: String, unique: true, required: true },
    actionType: {
      type: String,
      enum: Object.keys(MULTISIG_ACTIONS).map(
        (k) => MULTISIG_ACTIONS[k].action,
      ),
      required: true,
    },
    batchId: { type: String, required: true },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "expired",
        "cancelled",
        "executed",
      ],
      default: "pending",
    },
    config: {
      requiredApprovals: { type: Number, required: true },
      expiresAt: { type: Date, required: true },
    },
    justification: { type: String, required: true, maxlength: 2000 },
    evidence: [
      {
        type: {
          type: String,
          enum: ["image", "document", "lab_report", "video", "other"],
        },
        cid: String,
        hash: String,
        description: String,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    signatures: [signatureSchema],
    approvalCount: { type: Number, default: 0 },
    rejectionCount: { type: Number, default: 0 },
    finalRejection: {
      rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      rejectedAt: Date,
      reason: String,
    },
    execution: {
      executedAt: Date,
      executedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      txHash: String,
      result: mongoose.Schema.Types.Mixed,
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    auditTrail: [auditEntrySchema],
  },
  { timestamps: true },
);

// Indexes
multiSigApprovalSchema.index({ batchId: 1 });
multiSigApprovalSchema.index({ status: 1 });
multiSigApprovalSchema.index({ initiatedBy: 1 });
multiSigApprovalSchema.index({ createdAt: -1 });
multiSigApprovalSchema.index({ "config.expiresAt": 1 });
multiSigApprovalSchema.index({ batchId: 1, actionType: 1, status: 1 });

// Virtuals
multiSigApprovalSchema.virtual("isExpired").get(function () {
  return new Date() > this.config.expiresAt;
});

multiSigApprovalSchema.virtual("hasEnoughApprovals").get(function () {
  return this.approvalCount >= this.config.requiredApprovals;
});

// Instance methods
multiSigApprovalSchema.methods.addSignature = async function (signatureData) {
  const { inspector, decision, signature, reason, ipAddress } = signatureData;
  const existingSignature = this.signatures.find(
    (s) => s.inspector.toString() === inspector.toString(),
  );
  if (existingSignature)
    throw new Error("Inspector has already signed this approval request");

  this.signatures.push({
    inspector,
    inspectorCertificationId: signatureData.certificationId,
    walletAddress: signatureData.walletAddress,
    decision,
    signedAt: new Date(signatureData.timestamp || Date.now()),
    signature,
    reason,
    ipAddress,
  });

  if (decision === "approved") this.approvalCount += 1;
  else this.rejectionCount += 1;

  this.auditTrail.push({
    action: `signature_${decision}`,
    performedBy: inspector,
    details: reason || `Inspector ${decision}`,
    ipAddress,
  });

  if (this.hasEnoughApprovals) {
    this.status = "approved";
    this.auditTrail.push({
      action: "approval_threshold_reached",
      details: `Required ${this.config.requiredApprovals} approvals reached`,
    });
  }

  const possibleApprovals = this.config.requiredApprovals - this.approvalCount;
  if (this.rejectionCount > possibleApprovals && this.status === "pending") {
    this.status = "rejected";
    this.finalRejection = {
      rejectedBy: inspector,
      rejectedAt: new Date(),
      reason: reason || "Insufficient approvals possible",
    };
  }

  await this.save();
  return this;
};

multiSigApprovalSchema.methods.cancel = async function (cancelledBy, reason) {
  if (this.status !== "pending")
    throw new Error("Can only cancel pending approval requests");
  this.status = "cancelled";
  this.auditTrail.push({
    action: "cancelled",
    performedBy: cancelledBy,
    details: reason,
    timestamp: new Date(),
  });
  await this.save();
  return this;
};

multiSigApprovalSchema.methods.markExecuted = async function (
  executedBy,
  txHash,
  result,
) {
  if (this.status !== "approved")
    throw new Error("Can only execute approved requests");
  this.status = "executed";
  this.execution = { executedAt: new Date(), executedBy, txHash, result };
  this.auditTrail.push({
    action: "executed",
    performedBy: executedBy,
    details: `Action executed with tx: ${txHash || "N/A"}`,
  });
  await this.save();
  return this;
};

// Static methods
multiSigApprovalSchema.statics.findPendingForBatch = function (
  batchId,
  actionType = null,
) {
  const query = { batchId, status: "pending" };
  if (actionType) query.actionType = actionType;
  return this.find(query).sort({ createdAt: -1 });
};

multiSigApprovalSchema.statics.findRequiringSignature = function (inspectorId) {
  return this.find({
    status: "pending",
    "signatures.inspector": { $ne: inspectorId },
    "config.expiresAt": { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

multiSigApprovalSchema.statics.hasPendingRequest = async function (
  batchId,
  actionType,
) {
  const count = await this.countDocuments({
    batchId,
    actionType,
    status: "pending",
    "config.expiresAt": { $gt: new Date() },
  });
  return count > 0;
};

multiSigApprovalSchema.statics.generateRequestId = function () {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `MSA-${timestamp}-${random}`.toUpperCase();
};

multiSigApprovalSchema.pre("save", function (next) {
  if (this.isExpired && this.status === "pending") {
    this.status = "expired";
    this.auditTrail.push({
      action: "expired",
      details: "Approval request expired",
    });
  }
  next();
});

module.exports = mongoose.model("MultiSigApproval", multiSigApprovalSchema);
