"use client";

import React, { useState, useEffect, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  MapPin,
  Truck,
  RefreshCw,
  Navigation,
  Play,
  Pause,
  ChevronRight,
  CheckCircle2,
  Award,
  Map,
  ShieldAlert,
  GripVertical,
  ExternalLink,
} from "lucide-react";
import ProtectedRoute from "../../../components/ProtectedRoute";
import { useAuth } from "../../../context/AuthContext";
import {
  realCropBatchService,
  BatchData,
} from "../../../services/realCropBatchService";
import {
  logisticsService,
  Waypoint,
  OptimizeRouteResponse,
} from "../../../services/logisticsService";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import toast from "react-hot-toast";

// Dynamically load MapComponent without SSR to prevent leaflet window error
const MapComponent = dynamic(() => import("../../../components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] bg-muted animate-pulse rounded-2xl flex items-center justify-center">
      <p className="text-muted-foreground font-medium">Loading Map Canvas...</p>
    </div>
  ),
});

// Default starting point (CropChain Hub Bangalore)
const DEFAULT_START: Waypoint = {
  lat: 12.9716,
  lng: 77.5946,
  address: "CropChain Hub, Central Bengaluru, Karnataka",
  type: "start",
};

export default function RouteOptimizerPage() {
  return (
    <ProtectedRoute allowedRoles={["transporter"]}>
      <RouteOptimizerComponent />
    </ProtectedRoute>
  );
}

function RouteOptimizerComponent() {
  const { user } = useAuth();

  // State
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [startPoint, setStartPoint] = useState<Waypoint>(DEFAULT_START);
  const [isOptimizing, startOptimize] = useTransition();
  const [isLoadingBatches, setIsLoadingBatches] = useState(true);

  // Result state
  const [routeData, setRouteData] = useState<OptimizeRouteResponse | null>(
    null,
  );

  // Delivery Mode state
  const [isDeliveryActive, setIsDeliveryActive] = useState(false);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);

  // Load Transporter batches
  useEffect(() => {
    loadBatches();
  }, []);

  const loadBatches = async () => {
    setIsLoadingBatches(true);
    try {
      // Fetch batches in mandi (ready for pickup) or transport (in transit) stages
      const data = await realCropBatchService.getAllBatches();
      const relevant = (data?.batches || []).filter(
        (b: any) =>
          b.currentStage === "mandi" || b.currentStage === "transport",
      );
      setBatches(relevant);

      // Auto-select first few batches to save time
      if (relevant.length > 0) {
        setSelectedBatchIds(relevant.slice(0, 4).map((b: any) => b.batchId));
      }
    } catch (error: any) {
      toast.error("Failed to load active crop batches");
      console.error(error);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  // Trigger route optimization request
  const handleOptimize = async () => {
    if (selectedBatchIds.length === 0) {
      toast.error("Please select at least one batch to optimize the route");
      return;
    }

    startOptimize(async () => {
      try {
        const coords: Waypoint[] = [startPoint];

        // Gather coordinates from selected batches
        // Each batch gives:
        // 1. Pickup: origin/farmer location (for 'mandi' stage batches)
        // 2. Dropoff: buyer destination (simulated or set)
        selectedBatchIds.forEach((id) => {
          const batch = batches.find((b) => b.batchId === id);
          if (batch) {
            // Add Pickup Stop (Mandi / Origin)
            coords.push({
              lat:
                batch.currentStage === "mandi"
                  ? 12.9 + (Math.random() - 0.5) * 0.4
                  : 12.92, // mock offset around Blr
              lng:
                batch.currentStage === "mandi"
                  ? 77.5 + (Math.random() - 0.5) * 0.4
                  : 77.61,
              address: batch.origin || `${batch.farmerName}'s Farm`,
              type: "pickup",
              batchId: batch.batchId,
            });

            // Add Dropoff Stop (Retailer / Destination)
            coords.push({
              lat: 13.0 + (Math.random() - 0.5) * 0.3, // mock buyer location
              lng: 77.6 + (Math.random() - 0.5) * 0.3,
              address: `Buyer Outlet for Batch ${batch.batchId.slice(0, 8)}`,
              type: "dropoff",
              batchId: batch.batchId,
            });
          }
        });

        const result = await logisticsService.optimizeRoute(coords);
        setRouteData(result);
        setIsDeliveryActive(false);
        setCurrentWaypointIndex(0);

        if (result.isFallback) {
          toast.success("Route calculated locally (offline fallback mode)");
        } else {
          toast.success("Optimal multi-stop route generated!");
        }
      } catch (error: any) {
        toast.error(error.message || "Route optimization failed");
        console.error(error);
      }
    });
  };

  // Toggle selection of batches
  const toggleBatchSelection = (batchId: string) => {
    setSelectedBatchIds((prev) =>
      prev.includes(batchId)
        ? prev.filter((id) => id !== batchId)
        : [...prev, batchId],
    );
  };

  // Drag and Drop Event Handlers for manual sequence override
  const handleDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    // Avoid dragging the start location (index 0)
    if (index === 0) return;
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    index: number,
  ) => {
    // Prevent default to allow drop. Also ensure we don't drop onto the start location
    if (index === 0) return;
    e.preventDefault();
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLDivElement>,
    targetIndex: number,
  ) => {
    if (targetIndex === 0 || !routeData) return;

    const sourceIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const newCoordinates = [...routeData.orderedCoordinates];
    const [draggedItem] = newCoordinates.splice(sourceIndex, 1);
    newCoordinates.splice(targetIndex, 0, draggedItem);

    // Call API with the manual sequence to get new polyline geometry and distance matrix calculations
    try {
      const result = await logisticsService.optimizeRoute(newCoordinates);
      setRouteData(result);
      toast.success("Itinerary adjusted & route re-calculated!");
    } catch (error: any) {
      toast.error("Failed to update manual route sequence");
    }
  };

  const formatDistance = (m: number) => {
    return (m / 1000).toFixed(1) + " km";
  };

  const formatDuration = (s: number) => {
    const hours = Math.floor(s / 3600);
    const minutes = Math.round((s % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes} mins`;
  };

  // Handle waypoint arrival in Start Delivery Mode
  const handleWaypointComplete = () => {
    if (!routeData) return;
    const currentWaypoint = routeData.orderedCoordinates[currentWaypointIndex];

    toast.success(
      `Arrived at Stop ${currentWaypointIndex}: ${currentWaypoint.address}`,
    );

    if (currentWaypointIndex < routeData.orderedCoordinates.length - 1) {
      setCurrentWaypointIndex((prev) => prev + 1);
    } else {
      setIsDeliveryActive(false);
      toast.success("All deliveries completed successfully! 🏆", {
        duration: 6000,
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 pb-6 text-left">
        <div className="flex items-center gap-4">
          <Link href="/transporter">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-muted"
            >
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Multi-Stop Route Optimizer
            </h1>
            <p className="text-sm text-muted-foreground">
              Calculate the most efficient path for pickup and deliveries
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadBatches}
          className="gap-1.5"
          disabled={isLoadingBatches}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isLoadingBatches ? "animate-spin" : ""}`}
          />
          Reload Batches
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8 text-left">
        {/* Left Side: Setup & Crop Batch List */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">1. Start Coordinates</CardTitle>
              <CardDescription>
                Specify the route beginning point
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Address
                </label>
                <div className="flex gap-2">
                  <MapPin className="h-5 w-5 text-blue-500 mt-1 shrink-0" />
                  <input
                    type="text"
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    value={startPoint.address}
                    onChange={(e) =>
                      setStartPoint((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none focus:ring-1"
                    value={startPoint.lat}
                    onChange={(e) =>
                      setStartPoint((prev) => ({
                        ...prev,
                        lat: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    className="w-full bg-background border border-border rounded-lg p-2 text-sm text-foreground focus:outline-none focus:ring-1"
                    value={startPoint.lng}
                    onChange={(e) =>
                      setStartPoint((prev) => ({
                        ...prev,
                        lng: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-lg">2. Active Shipments</CardTitle>
              <CardDescription>
                Select batches to include in optimization
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingBatches ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading shipments...
                </div>
              ) : batches.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No active batches ready for transport.
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                  {batches.map((batch) => {
                    const isSelected = selectedBatchIds.includes(batch.batchId);
                    return (
                      <div
                        key={batch.batchId}
                        className={`flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors ${isSelected ? "bg-muted/20" : ""}`}
                        onClick={() => toggleBatchSelection(batch.batchId)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by div onClick
                          className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                        />
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-semibold text-foreground truncate capitalize">
                            {batch.cropType} ({batch.quantity} kg)
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            Origin: {batch.origin}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Badge
                              variant="secondary"
                              className="text-[10px] py-0 px-1.5"
                            >
                              {batch.currentStage === "mandi"
                                ? "Ready Pickup"
                                : "In Transit"}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              #{batch.batchId.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
            <div className="p-4 border-t border-border bg-muted/20">
              <Button
                onClick={handleOptimize}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium gap-2"
                disabled={isOptimizing || selectedBatchIds.length === 0}
              >
                <Truck className="h-4 w-4" />
                {isOptimizing ? "Optimizing..." : "Calculate Route"}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Side: Route Map and Draggable Itinerary */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary / Stats Bar */}
          {routeData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="border-border">
                <CardContent className="pt-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Total Distance
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-foreground mt-1">
                    {formatDistance(routeData.totalDistance)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Estimated Duration
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-foreground mt-1">
                    {formatDuration(routeData.totalDuration)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border">
                <CardContent className="pt-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Total Stops
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-foreground mt-1">
                    {routeData.orderedCoordinates.length}
                  </p>
                </CardContent>
              </Card>
              <div className="flex items-center">
                {!isDeliveryActive ? (
                  <Button
                    onClick={() => {
                      setIsDeliveryActive(true);
                      setCurrentWaypointIndex(0);
                    }}
                    className="w-full h-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 gap-2 flex items-center justify-center rounded-xl"
                  >
                    <Play className="h-5 w-5 fill-white" />
                    Start Delivery
                  </Button>
                ) : (
                  <Button
                    onClick={() => setIsDeliveryActive(false)}
                    variant="destructive"
                    className="w-full h-full font-semibold py-4 gap-2 flex items-center justify-center rounded-xl"
                  >
                    <Pause className="h-5 w-5" />
                    Cancel Delivery
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Delivery Mode Banner */}
          {isDeliveryActive && routeData && (
            <Card className="border-2 border-emerald-500/30 bg-emerald-500/5 shadow-md">
              <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex gap-3">
                  <div className="bg-emerald-500 text-white font-bold h-10 w-10 rounded-full flex items-center justify-center shrink-0 shadow">
                    {currentWaypointIndex === 0 ? "S" : currentWaypointIndex}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                        Active Stop - Navigation Mode
                      </span>
                      {routeData.orderedCoordinates[currentWaypointIndex]
                        .type && (
                        <Badge className="bg-blue-600/10 text-blue-500 border-none capitalize h-5 py-0">
                          {
                            routeData.orderedCoordinates[currentWaypointIndex]
                              .type
                          }
                        </Badge>
                      )}
                    </div>
                    <p className="text-base font-semibold text-foreground mt-0.5">
                      {
                        routeData.orderedCoordinates[currentWaypointIndex]
                          .address
                      }
                    </p>
                    {routeData.orderedCoordinates[currentWaypointIndex]
                      .batchId && (
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        Batch:{" "}
                        {
                          routeData.orderedCoordinates[currentWaypointIndex]
                            .batchId
                        }
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${routeData.orderedCoordinates[currentWaypointIndex].lat},${routeData.orderedCoordinates[currentWaypointIndex].lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 md:flex-initial"
                  >
                    <Button
                      variant="outline"
                      className="w-full gap-1.5 text-foreground hover:bg-muted"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Google Maps
                    </Button>
                  </a>
                  <Button
                    onClick={handleWaypointComplete}
                    className="flex-1 md:flex-initial bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {currentWaypointIndex ===
                    routeData.orderedCoordinates.length - 1
                      ? "Finish Delivery"
                      : "Arrived / Next"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Map + Itinerary Split Screen */}
          <div className="grid md:grid-cols-5 gap-6">
            <div className="md:col-span-3 h-[450px]">
              {routeData ? (
                <MapComponent
                  coordinates={routeData.orderedCoordinates}
                  geometry={routeData.geometry}
                />
              ) : (
                <div className="w-full h-full min-h-[450px] bg-muted/40 rounded-2xl flex flex-col items-center justify-center p-8 border border-border border-dashed">
                  <Map className="h-12 w-12 text-muted-foreground/60 mb-3 animate-pulse" />
                  <p className="font-semibold text-foreground text-center">
                    No Route Calculated
                  </p>
                  <p className="text-sm text-muted-foreground text-center mt-1 max-w-[280px]">
                    Select active shipments and click "Calculate Route" to plan
                    the path
                  </p>
                </div>
              )}
            </div>

            {/* Draggable Itinerary sidebar */}
            <div className="md:col-span-2">
              <Card className="h-full border-border flex flex-col">
                <CardHeader className="pb-3 border-b border-border/40">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Itinerary Details</span>
                    {routeData && (
                      <span className="text-[10px] text-muted-foreground font-normal">
                        Drag items to reorder sequence
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-4 max-h-[360px]">
                  {!routeData ? (
                    <div className="h-full flex items-center justify-center text-center text-muted-foreground text-sm p-4">
                      Itinerary sequence will appear here once optimized.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {routeData.orderedCoordinates.map((coord, index) => {
                        const isStart = index === 0;
                        const isActive =
                          isDeliveryActive && currentWaypointIndex === index;
                        const isCompleted =
                          isDeliveryActive && index < currentWaypointIndex;

                        let badgeColor =
                          "bg-blue-600/10 text-blue-500 border-none capitalize";
                        if (coord.type === "pickup")
                          badgeColor =
                            "bg-amber-600/10 text-amber-500 border-none capitalize";
                        if (coord.type === "dropoff")
                          badgeColor =
                            "bg-emerald-600/10 text-emerald-500 border-none capitalize";

                        return (
                          <div
                            key={index}
                            draggable={!isStart}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                              isStart
                                ? "bg-muted/30 border-dashed border-border/60 cursor-default"
                                : "bg-card border-border hover:shadow-sm cursor-grab active:cursor-grabbing"
                            } ${isActive ? "ring-2 ring-emerald-500 border-transparent" : ""} ${
                              isCompleted
                                ? "opacity-50 line-through bg-muted/20"
                                : ""
                            }`}
                          >
                            {!isStart ? (
                              <GripVertical className="h-4 w-4 text-muted-foreground mt-1 shrink-0 cursor-grab" />
                            ) : (
                              <div className="w-4 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-xs text-foreground">
                                  Stop {isStart ? "0 (Start)" : index}
                                </span>
                                {coord.type && (
                                  <Badge className={badgeColor}>
                                    {coord.type}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm font-medium text-foreground mt-1 truncate">
                                {coord.address}
                              </p>
                              {coord.batchId && (
                                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                  Batch: {coord.batchId.slice(0, 8)}...
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
