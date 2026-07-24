"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { realCropBatchService } from "../../services/realCropBatchService";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  AlertOctagon,
  Info,
} from "lucide-react";
import ProtectedRoute from "../../components/ProtectedRoute";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import toast from "react-hot-toast";

function IncidentsDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"incidents" | "pending">(
    "incidents",
  );
  const [batches, setBatches] = useState<any[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Modal state for Admin recall request
  const [showRecallModal, setShowRecallModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [justification, setJustification] = useState("");

  // Modal state for Inspector approval
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [approvalDecision, setApprovalDecision] = useState<
    "approved" | "rejected"
  >("approved");
  const [approvalReason, setApprovalReason] = useState("");

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === "incidents") {
        const data = await realCropBatchService.getAllBatches();
        const allBatches = data?.batches || [];
        // Filter flagged, spoiled, or recalled
        const incidentBatches = allBatches.filter(
          (b: any) => b.isRecalled || b.status === "Flagged" || b.isSpoiled,
        );
        setBatches(incidentBatches);
      } else {
        const data = await realCropBatchService.getPendingApprovals();
        setPendingApprovals(data || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestRecall = async () => {
    if (!selectedBatchId || justification.length < 20) {
      toast.error(
        "Please provide a valid Batch ID and Justification (min 20 characters).",
      );
      return;
    }
    setIsActionLoading(true);
    try {
      await realCropBatchService.requestRecall(selectedBatchId, justification);
      toast.success("Recall request created successfully.");
      setShowRecallModal(false);
      setJustification("");
      setSelectedBatchId("");
      fetchData();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to create recall request.",
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleApproveReject = async () => {
    if (!selectedRequestId) return;
    setIsActionLoading(true);
    try {
      await realCropBatchService.approveRequest(
        selectedRequestId,
        approvalDecision,
        approvalReason,
      );
      toast.success(`Request ${approvalDecision} successfully.`);
      setShowApprovalModal(false);
      setApprovalReason("");
      fetchData();
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message || "Failed to process request.",
      );
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-8 px-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-red-500/10 p-3 rounded-2xl">
            <AlertOctagon className="h-8 w-8 text-red-600" />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Incident Management Center
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage recalls, contaminations, and flagged batches.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {user?.role === "admin" && (
            <Button
              onClick={() => setShowRecallModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <AlertTriangle className="mr-2 h-4 w-4" /> Request Recall
            </Button>
          )}
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />{" "}
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border/40">
        <button
          onClick={() => setActiveTab("incidents")}
          className={`pb-3 font-semibold text-sm transition-colors ${activeTab === "incidents" ? "text-red-600 border-b-2 border-red-600" : "text-muted-foreground hover:text-foreground"}`}
        >
          Flagged & Recalled Batches
        </button>
        <button
          onClick={() => setActiveTab("pending")}
          className={`pb-3 font-semibold text-sm transition-colors ${activeTab === "pending" ? "text-red-600 border-b-2 border-red-600" : "text-muted-foreground hover:text-foreground"}`}
        >
          Pending Approvals
        </button>
      </div>

      {/* Content */}
      <Card className="border border-border bg-card">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading...
            </div>
          ) : activeTab === "incidents" ? (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="py-4 px-6">Batch ID</TableHead>
                  <TableHead className="py-4 px-6">Status</TableHead>
                  <TableHead className="py-4 px-6">Crop</TableHead>
                  <TableHead className="py-4 px-6">Quantity</TableHead>
                  <TableHead className="py-4 px-6">Current Stage</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No incidents found.
                    </TableCell>
                  </TableRow>
                ) : (
                  batches.map((batch) => (
                    <TableRow
                      key={batch.batchId}
                      className="border-b border-border/40 hover:bg-muted/30"
                    >
                      <TableCell className="py-4 px-6 font-mono text-xs">
                        {batch.batchId}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        {batch.isRecalled ? (
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-200 border-red-200">
                            RECALLED
                          </Badge>
                        ) : batch.status === "Flagged" ? (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-amber-200">
                            FLAGGED
                          </Badge>
                        ) : batch.isSpoiled ? (
                          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200">
                            SPOILED
                          </Badge>
                        ) : (
                          <Badge variant="outline">UNKNOWN</Badge>
                        )}
                      </TableCell>
                      <TableCell className="py-4 px-6 capitalize font-medium">
                        {batch.cropType}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        {batch.quantity} kg
                      </TableCell>
                      <TableCell className="py-4 px-6 capitalize">
                        {batch.currentStage}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="py-4 px-6">Request ID</TableHead>
                  <TableHead className="py-4 px-6">Action</TableHead>
                  <TableHead className="py-4 px-6">Batch ID</TableHead>
                  <TableHead className="py-4 px-6">Approvals</TableHead>
                  <TableHead className="py-4 px-6">Justification</TableHead>
                  <TableHead className="py-4 px-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No pending approvals.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingApprovals.map((req) => (
                    <TableRow
                      key={req.requestId}
                      className="border-b border-border/40 hover:bg-muted/30"
                    >
                      <TableCell className="py-4 px-6 font-mono text-xs">
                        {req.requestId}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant="outline" className="uppercase text-xs">
                          {req.actionType.replace("batch_", "")}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 font-mono text-xs">
                        {req.batchId}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        {req.approvalCount} / {req.config?.requiredApprovals}
                      </TableCell>
                      <TableCell
                        className="py-4 px-6 max-w-[200px] truncate"
                        title={req.justification}
                      >
                        {req.justification}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        {(user?.role as string) === "quality_inspector" && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRequestId(req.requestId);
                              setShowApprovalModal(true);
                            }}
                            className="bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            Review
                          </Button>
                        )}
                        {user?.role === "admin" && (
                          <span className="text-xs text-muted-foreground">
                            Awaiting Inspector
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recall Request Modal */}
      {showRecallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl p-6 shadow-2xl border border-border">
            <h2 className="text-xl font-bold mb-4 text-foreground">
              Request Batch Recall
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1 block text-foreground">
                  Batch ID
                </label>
                <input
                  type="text"
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  placeholder="e.g. CROP-2024-XXXX"
                />
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block text-foreground">
                  Justification (min 20 chars)
                </label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-input bg-background h-32 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
                  placeholder="Provide detailed reason for recall..."
                />
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRecallModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRequestRecall}
                  disabled={isActionLoading}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {isActionLoading ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-md rounded-xl p-6 shadow-2xl border border-border">
            <h2 className="text-xl font-bold mb-4 text-foreground">
              Review Request
            </h2>
            <p className="text-xs font-mono text-muted-foreground mb-6 bg-muted p-2 rounded">
              {selectedRequestId}
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-1 block text-foreground">
                  Decision
                </label>
                <select
                  value={approvalDecision}
                  onChange={(e: any) => setApprovalDecision(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-input bg-background focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                >
                  <option value="approved">Approve</option>
                  <option value="rejected">Reject</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold mb-1 block text-foreground">
                  Reason / Notes
                </label>
                <textarea
                  value={approvalReason}
                  onChange={(e) => setApprovalReason(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-input bg-background h-32 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
                  placeholder="Provide any notes for this decision..."
                />
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowApprovalModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApproveReject}
                  disabled={isActionLoading}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {isActionLoading ? "Processing..." : "Confirm Decision"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "quality_inspector"]}>
      <IncidentsDashboard />
    </ProtectedRoute>
  );
}
