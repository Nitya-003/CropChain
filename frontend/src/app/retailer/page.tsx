"use client";
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ShoppingBag,
  Package,
  RefreshCw,
  CheckCircle,
  Clock,
  TrendingUp,
  Search,
  ArrowRight,
  Tag,
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
import BatchSyncBadge from "../../components/BatchSyncBadge";

const RELEVANT_STAGES = ["transport", "retailer"];

const RetailerDashboardComponent: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [activeAuctions, setActiveAuctions] = useState<Auction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    limit: 100,
  });

  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const activeCount = Object.entries(filters).filter(([key, val]) => {
    if (key === "sortBy" && val === "createdAt") return false;
    if (key === "sortOrder" && val === "desc") return false;
    if (key === "page" && val === 1) return false;
    if (key === "limit" && val === 100) return false;
    return val !== "";
  }).length;

  useEffect(() => {
    loadBatches();
  }, [
    filters.search,
    filters.cropType,
    filters.status,
    filters.dateFrom,
    filters.dateTo,
    filters.sortBy,
    filters.sortOrder,
  ]);

  const loadBatches = async () => {
    setIsLoading(true);
    try {
      const apiFilters: any = {};
      Object.entries(filters).forEach(([key, val]) => {
        if (
          val !== undefined &&
          val !== "" &&
          key !== "stage" &&
          key !== "page" &&
          key !== "limit"
        ) {
          apiFilters[key] = val;
        }
      });
      apiFilters.limit = 100;

      const data = await realCropBatchService.getAllBatches(apiFilters);
      const allBatches: any[] = data?.batches || [];

      try {
        const auctions = await auctionService.getAllAuctions();
        setActiveAuctions(auctions);
      } catch (err) {
        console.error("Failed to load active auctions:", err);
      }

      // Retailer sees batches in transport (incoming) or at retailer stage (received)
      const relevantBatches = allBatches.filter((b: any) =>
        RELEVANT_STAGES.includes(b.currentStage),
      );

      setBatches(relevantBatches);
    } catch (error) {
      console.error("Failed to load batches:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const paginatedBatches = useMemo(() => {
    const start = (page - 1) * pageSize;
    return batches.slice(start, start + pageSize);
  }, [batches, page]);

  const totalPages = Math.max(1, Math.ceil(batches.length / pageSize));
  const stats = useMemo(
    () => ({
      incomingShipments: batches.filter(
        (b: any) => b.currentStage === "transport",
      ).length,
      receivedBatches: batches.filter((b: any) => b.currentStage === "retailer")
        .length,
      totalQuantity: batches.reduce(
        (sum: number, b: any) => sum + (b.quantity || 0),
        0,
      ),
    }),
    [batches],
  );

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
      limit: 100,
    });
    setPage(1);
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

  if (isLoading) {
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
          <div className="bg-purple-500/10 p-3 rounded-2xl">
            <ShoppingBag className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {t("retailer.dashboard")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("retailer.welcomeBack", { name: user?.name || "Retailer" })}
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
          <Link href="/update-batch">
            <Button
              size="sm"
              className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Tag className="h-3.5 w-3.5" />
              {t("retailer.markAsReceived")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t("retailer.incomingShipments")}
            </span>
            <div className="bg-blue-500/10 p-2 rounded-xl">
              <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-left">
            <div className="text-3xl font-bold tracking-tight">
              {stats.incomingShipments}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("retailer.batchesInTransitToStore")}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t("retailer.received")}
            </span>
            <div className="bg-purple-500/10 p-2 rounded-xl">
              <CheckCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-left">
            <div className="text-3xl font-bold tracking-tight">
              {stats.receivedBatches}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("retailer.batchesReceivedOnSale")}
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">
              {t("retailer.totalInventory")}
            </span>
            <div className="bg-emerald-500/10 p-2 rounded-xl">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-left">
            <div className="text-3xl font-bold tracking-tight">
              {stats.totalQuantity.toLocaleString()}{" "}
              <span className="text-lg font-medium text-muted-foreground">
                kg
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("retailer.combinedStock")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link href="/update-batch">
          <Card className="border border-border bg-card hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all cursor-pointer group">
            <CardContent className="flex items-center gap-4 py-5 px-6">
              <div className="bg-purple-500/10 p-3 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                <Tag className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">
                  {t("retailer.markAsReceivedSold")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("retailer.updateBatchOnDelivery")}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/track-batch">
          <Card className="border border-border bg-card hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all cursor-pointer group">
            <CardContent className="flex items-center gap-4 py-5 px-6">
              <div className="bg-emerald-500/10 p-3 rounded-xl group-hover:bg-emerald-500/20 transition-colors">
                <Search className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-foreground">
                  {t("retailer.verifyBatch")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("retailer.checkProvenance")}
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
            onFilterChange={(partial) => {
              setFilters((f) => ({ ...f, ...partial }));
              setPage(1);
            }}
            onSearchSubmit={(search) => {
              setFilters((f) => ({ ...f, search, page: 1 }));
              setPage(1);
            }}
            onClearFilters={clearFilters}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            activeFilterCount={activeCount}
          />
        </CardContent>
      </Card>

      {/* Batches Table */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold text-foreground">
              {t("retailer.inventoryAndIncoming")}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="bg-muted p-4 rounded-full">
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
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
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {t("retailer.noBatchesYet")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("mandi.adjustFilters")}
                </p>
              </div>
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
                      {t("batch.farmer")}
                    </TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">
                      {t("batch.cropType")}
                    </TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">
                      {t("batch.quantity")}
                    </TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">
                      {t("batch.harvestDate")}
                    </TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">
                      {t("batch.status")}
                    </TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">
                      {t("common.actions", "Actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBatches.map((batch) => {
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
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              {batch.farmerName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {batch.origin}
                            </p>
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
                            {batch.harvestDate
                              ? new Date(batch.harvestDate).toLocaleDateString()
                              : "—"}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex flex-col gap-1.5 items-start">
                            <Badge
                              variant="outline"
                              className={`capitalize font-semibold border ${getStageColor(batch.currentStage)}`}
                            >
                              {batch.currentStage === "transport"
                                ? t("retailer.inTransitBadge")
                                : t("retailer.receivedBadge")}
                            </Badge>
                            {activeAuction && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-bold uppercase tracking-wide border ${
                                  activeAuction.status === "active"
                                    ? "bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse"
                                    : "bg-slate-100 text-slate-600 border-slate-300/30 dark:bg-slate-800/40 dark:text-slate-400"
                                }`}
                              >
                                {activeAuction.status === "active"
                                  ? t("auction.liveAuction")
                                  : t("auction.auctionEnded")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-1.5">
                            {batch.currentStage === "transport" ? (
                              <Link href={`/update-batch?id=${batch.batchId}`}>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white h-8 rounded-lg text-xs"
                                >
                                  <Tag className="h-3.5 w-3.5" />
                                  {t("retailer.receive")}
                                </Button>
                              </Link>
                            ) : (
                              <Link href={`/track-batch?id=${batch.batchId}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-muted-foreground hover:text-foreground h-8 rounded-lg text-xs"
                                >
                                  <ArrowRight className="h-3.5 w-3.5" />
                                  {t("farmer.view")}
                                </Button>
                              </Link>
                            )}
                            {activeAuction && (
                              <Link href={`/auctions/${activeAuction._id}`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 text-slate-500 h-8 rounded-lg text-xs"
                                >
                                  <Gavel className="h-3.5 w-3.5" />
                                  {activeAuction.status === "active"
                                    ? t("retailer.bidRoom")
                                    : t("auction.auctionEnded")}
                                </Button>
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {batches.length > 0 && totalPages > 1 && (
          <CardFooter className="flex items-center justify-between border-t border-border/40 py-4 px-6">
            <p className="text-xs text-muted-foreground">
              {t("pagination.showing", {
                count: paginatedBatches.length,
                total: batches.length,
              })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 rounded-lg text-xs"
              >
                {t("pagination.previous")}
              </Button>
              <span className="text-xs font-semibold text-foreground">
                {t("pagination.page", { current: page, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 rounded-lg text-xs"
              >
                {t("pagination.next")}
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default function RetailerDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["retailer"]}>
      <RetailerDashboardComponent />
    </ProtectedRoute>
  );
}
