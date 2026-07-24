"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Leaf,
  Package,
  Plus,
  RefreshCw,
  TrendingUp,
  Clock,
  MapPin,
  Eye,
  Gavel,
} from "lucide-react";
import Link from "next/link";
import { realCropBatchService } from "../../services/realCropBatchService";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "../../components/ui/table";
import ProtectedRoute from "../../components/ProtectedRoute";
import { useAuth } from "../../context/AuthContext";
import BatchFilters from "../../components/BatchFilters";
import { auctionService, Auction } from "../../services/auctionService";
import toast from "react-hot-toast";
import BatchSyncBadge from "../../components/BatchSyncBadge";

const FarmerDashboardComponent: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBatches: 0,
    totalQuantity: 0,
    activeBatches: 0,
  });

  const [filters, setFilters] = useState({
    search: "",
    stage: "",
    cropType: "",
    status: "",
    dateFrom: "",
    dateTo: "",
    sortBy: "createdAt",
    sortOrder: "desc",
    page: 1,
    limit: 10,
  });

  const [pagination, setPagination] = useState({
    totalItems: 0,
    currentPage: 1,
    totalPages: 1,
    limit: 10,
  });

  const [searchInput, setSearchInput] = useState("");

  // Auction modal states
  const [isAuctionModalOpen, setIsAuctionModalOpen] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [startPrice, setStartPrice] = useState<string>("500");
  const [duration, setDuration] = useState<string>("5");
  const [submittingAuction, setSubmittingAuction] = useState(false);

  const handleCreateAuction = async () => {
    if (!selectedBatchId) return;
    const priceNum = Number(startPrice);
    const durationNum = Number(duration);
    if (isNaN(priceNum) || priceNum <= 0) {
      toast.error(t("validation.validPositiveNumber"));
      return;
    }
    if (isNaN(durationNum) || durationNum <= 0) {
      toast.error(t("validation.validDuration"));
      return;
    }
    setSubmittingAuction(true);
    try {
      await auctionService.createAuction(
        selectedBatchId,
        priceNum,
        durationNum,
      );
      toast.success("Live Auction started successfully!");
      setIsAuctionModalOpen(false);
      loadBatches();
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to start auction";
      toast.error(message);
    } finally {
      setSubmittingAuction(false);
    }
  };

  const activeCount = Object.entries(filters).filter(([key, val]) => {
    if (key === "sortBy" && val === "createdAt") return false;
    if (key === "sortOrder" && val === "desc") return false;
    if (key === "page" && val === 1) return false;
    if (key === "limit" && val === 10) return false;
    return val !== "";
  }).length;

  const loadBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiFilters: any = {};
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== "") {
          apiFilters[key] = val;
        }
      });
      if (user?.name) {
        apiFilters.farmerName = user.name;
      }

      const data = await realCropBatchService.getAllBatches(apiFilters);
      const allBatches: any[] = data?.batches || [];

      try {
        const auctions = await auctionService.getAllAuctions();
        setActiveAuctions(auctions);
      } catch (err) {
        console.error("Failed to load active auctions:", err);
      }

      setBatches(allBatches);
      setStats({
        totalBatches: allBatches.length,
        totalQuantity: allBatches.reduce(
          (sum: number, b: any) => sum + (b.quantity || 0),
          0,
        ),
        activeBatches: allBatches.filter(
          (b: any) => b.currentStage !== "retailer",
        ).length,
      });
      if (data?.pagination) {
        setPagination({
          totalItems: data.pagination.totalItems || 0,
          currentPage: data.pagination.currentPage || 1,
          totalPages: data.pagination.totalPages || 1,
          limit: data.pagination.limit || 10,
        });
      }
    } catch (error) {
      console.error("Failed to load batches:", error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, user?.name]);

  useEffect(() => {
    if (user?.name) {
      loadBatches();
    }
  }, [loadBatches, user?.name]);

  const clearFilters = () => {
    setSearchInput("");
    setFilters({
      search: "",
      stage: "",
      cropType: "",
      status: "",
      dateFrom: "",
      dateTo: "",
      sortBy: "createdAt",
      sortOrder: "desc",
      page: 1,
      limit: 10,
    });
  };

  const getStageColor = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case "farmer":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-300/30";
      case "mandi":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300/30";
      case "transport":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300/30";
      case "retailer":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300/30";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-700/30";
    }
  };

  if (isLoading && batches.length === 0) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse py-6">
        <div className="text-center space-y-3">
          <div className="h-10 bg-muted rounded-lg w-64 mx-auto"></div>
          <div className="h-5 bg-muted rounded-lg w-96 mx-auto"></div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border bg-card">
              <CardHeader className="h-24"></CardHeader>
              <CardContent className="h-12"></CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-3 rounded-2xl">
            <Leaf className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t("farmer.dashboard")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("farmer.welcomeBack", {
                name: user?.name || t("actors.farmer"),
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadBatches}
            className="gap-1.5 bg-background/50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t("farmer.refresh")}
          </Button>
          <Link href="/add-batch">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {t("farmer.newBatch")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t("farmer.myBatches")}
            </span>
            <div className="bg-indigo-500/10 p-2 rounded-xl">
              <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-left">
            <div className="text-3xl font-bold tracking-tight">
              {isLoading ? (
                <div className="h-9 w-16 bg-muted animate-pulse rounded" />
              ) : (
                stats.totalBatches
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("farmer.totalBatchesCreated")}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t("farmer.totalQuantity")}
            </span>
            <div className="bg-emerald-500/10 p-2 rounded-xl">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-left">
            <div className="text-3xl font-bold tracking-tight">
              {isLoading ? (
                <div className="h-9 w-24 bg-muted animate-pulse rounded" />
              ) : (
                <>
                  {stats.totalQuantity.toLocaleString()}{" "}
                  <span className="text-lg font-medium text-muted-foreground">
                    kg
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("farmer.cumulativeQuantity")}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t("farmer.inTransit")}
            </span>
            <div className="bg-amber-500/10 p-2 rounded-xl">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-left">
            <div className="text-3xl font-bold tracking-tight">
              {isLoading ? (
                <div className="h-9 w-16 bg-muted animate-pulse rounded" />
              ) : (
                stats.activeBatches
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("farmer.batchesInSupplyChain")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/add-batch">
          <Card className="border border-border bg-card hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer group">
            <CardContent className="flex items-center gap-4 py-5 px-6">
              <div className="bg-indigo-500/10 p-3 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                <Plus className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">
                  {t("farmer.createNewBatch")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("farmer.registerOnBlockchain")}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/track-batch">
          <Card className="border border-border bg-card hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer group">
            <CardContent className="flex items-center gap-4 py-5 px-6">
              <div className="bg-emerald-500/10 p-3 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                <MapPin className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">
                  {t("farmer.trackBatch")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("farmer.monitorBatchJourney")}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Filters */}
      <Card className="border border-border bg-card/60 backdrop-blur-md shadow-sm">
        <CardContent className="p-6">
          <BatchFilters
            filters={filters}
            onFilterChange={(partial) =>
              setFilters((f) => ({ ...f, ...partial }))
            }
            onSearchSubmit={(search) =>
              setFilters((f) => ({ ...f, search, page: 1 }))
            }
            onClearFilters={clearFilters}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            activeFilterCount={activeCount}
          />
        </CardContent>
      </Card>

      {/* My Batches Table */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold text-foreground">
              {t("farmer.myBatches")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="bg-muted p-4 rounded-full">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {t("common.loading")}
                </p>
              </div>
            </div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="bg-muted p-4 rounded-full">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {t("farmer.noBatchesFound")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("farmer.adjustFiltersOrCreate")}
                </p>
              </div>
              <Link href="/add-batch">
                <Button size="sm" className="gap-1.5 mt-2">
                  <Plus className="h-3.5 w-3.5" />
                  {t("batch.createBatch")}
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/40">
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">
                      {t("batch.batchId")}
                    </TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">
                      {t("batch.cropType")}
                    </TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">
                      {t("batch.quantity")}
                    </TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">
                      {t("batch.origin")}
                    </TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">
                      {t("admin.currentStage", "Current Stage")}
                    </TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">
                      {t("common.actions", "Actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => {
                    const activeAuction = activeAuctions.find(
                      (a) => a.batchId === batch.batchId,
                    );
                    return (
                      <TableRow
                        key={batch.batchId}
                        className="border-b border-border/40 hover:bg-muted/30 transition-colors text-left"
                      >
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-muted text-muted-foreground px-2 py-1 rounded border border-border">
                              {batch.batchId?.slice(0, 8)}...
                              {batch.batchId?.slice(-4)}
                            </span>
                            {batch.syncStatus &&
                              batch.syncStatus !== "synced" && (
                                <BatchSyncBadge
                                  syncStatus={batch.syncStatus}
                                  showLabel={false}
                                  size="sm"
                                />
                              )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className="capitalize font-medium text-foreground text-sm">
                            {batch.cropType}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className="font-medium text-foreground text-sm">
                            {batch.quantity?.toLocaleString()} kg
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <span className="text-sm text-muted-foreground">
                            {batch.origin}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex flex-col gap-1.5 items-start">
                            <Badge
                              variant="outline"
                              className={`capitalize font-semibold border ${getStageColor(batch.currentStage)}`}
                            >
                              {batch.currentStage}
                            </Badge>
                            {activeAuction &&
                              activeAuction.status === "active" && (
                                <Badge
                                  variant="outline"
                                  className="bg-amber-500/10 text-amber-600 border-amber-500/30 font-bold animate-pulse text-[10px] uppercase tracking-wide"
                                >
                                  {t("auction.liveAuction")}
                                </Badge>
                              )}
                            {activeAuction &&
                              activeAuction.status === "ended" && (
                                <Badge
                                  variant="outline"
                                  className="bg-slate-100 text-slate-600 border-slate-300/30 text-[10px] dark:bg-slate-800/40 dark:text-slate-400 uppercase tracking-wide"
                                >
                                  {t("auction.auctionEnded")}
                                </Badge>
                              )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-1.5">
                            <Link href={`/track-batch?id=${batch.batchId}`}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-muted-foreground hover:text-foreground"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                {t("farmer.view")}
                              </Button>
                            </Link>
                            {activeAuction &&
                            activeAuction.status === "active" ? (
                              <Link href={`/auctions/${activeAuction._id}`}>
                                <Button
                                  size="sm"
                                  className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold h-8 rounded-lg text-xs"
                                >
                                  <Gavel className="h-3.5 w-3.5" />
                                  {t("farmer.auctionRoom")}
                                </Button>
                              </Link>
                            ) : activeAuction &&
                              activeAuction.status === "ended" ? (
                              <Link href={`/auctions/${activeAuction._id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-slate-500 h-8 rounded-lg text-xs"
                                >
                                  <Gavel className="h-3.5 w-3.5" />
                                  {t("farmer.results")}
                                </Button>
                              </Link>
                            ) : batch.currentStage === "farmer" ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedBatchId(batch.batchId);
                                  setIsAuctionModalOpen(true);
                                }}
                                className="gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10 font-bold h-8 rounded-lg text-xs"
                              >
                                <Gavel className="h-3.5 w-3.5" />
                                {t("farmer.startAuction")}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border/40 py-4 px-6">
                  <p className="text-xs text-muted-foreground">
                    {t("pagination.showing", {
                      count: batches.length,
                      total: pagination.totalItems,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.currentPage <= 1 || isLoading}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          page: pagination.currentPage - 1,
                        }))
                      }
                      className="h-8 rounded-lg text-xs"
                    >
                      {t("pagination.previous")}
                    </Button>
                    <span className="text-xs font-semibold text-foreground">
                      {t("pagination.page", {
                        current: pagination.currentPage,
                        total: pagination.totalPages,
                      })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        pagination.currentPage >= pagination.totalPages ||
                        isLoading
                      }
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          page: pagination.currentPage + 1,
                        }))
                      }
                      className="h-8 rounded-lg text-xs"
                    >
                      {t("pagination.next")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {/* Start Auction Modal */}
      {isAuctionModalOpen && selectedBatchId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md border border-border bg-card p-6 shadow-2xl space-y-6 text-left animate-in scale-in-95 duration-200">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary/10 p-2.5 rounded-xl">
                <Gavel className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {t("auction.startCropAuction")}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("auction.registerInMarket", { batchId: selectedBatchId })}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {t("auction.startingPrice")}
                </label>
                <input
                  type="number"
                  value={startPrice}
                  onChange={(e) => setStartPrice(e.target.value)}
                  className="w-full px-4 py-2.5 border border-border bg-muted/40 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/45 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  {t("auction.auctionDuration")}
                </label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-muted/40 border border-border text-foreground h-10 focus:outline-none"
                >
                  <option value="2">{t("auction.quickTest")}</option>
                  <option value="5">{t("auction.recommended")}</option>
                  <option value="15">{t("auction.fifteenMinutes")}</option>
                  <option value="60">{t("auction.oneHour")}</option>
                  <option value="1440">{t("auction.twentyFourHours")}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAuctionModalOpen(false)}
                className="rounded-xl px-4 h-9"
              >
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                disabled={submittingAuction}
                onClick={handleCreateAuction}
                className="rounded-xl px-4 h-9 font-semibold"
              >
                {submittingAuction
                  ? t("auction.creating")
                  : t("auction.startLiveBidding")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default function FarmerDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["farmer"]}>
      <FarmerDashboardComponent />
    </ProtectedRoute>
  );
}
