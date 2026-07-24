"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/AuthContext";
import { auctionService, Auction, Bid } from "../../../services/auctionService";
import { useAuctionSocket } from "../../../hooks/useAuctionSocket";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import ProtectedRoute from "../../../components/ProtectedRoute";
import {
  ArrowLeft,
  Clock,
  Coins,
  User,
  TrendingUp,
  MapPin,
  Package,
  ShieldCheck,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";

export default function AuctionRoomPage() {
  const params = useParams();
  const router = useRouter();
  const auctionId = params.id as string;
  const { user } = useAuth();

  const [auction, setAuction] = useState<Auction | null>(null);
  const [bidsList, setBidsList] = useState<Bid[]>([]);
  const [customBid, setCustomBid] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [timeState, setTimeState] = useState<
    "normal" | "warning" | "critical" | "ended"
  >("normal");

  const bidsEndRef = useRef<HTMLDivElement>(null);

  // Hook up WebSocket
  const { liveAuction, liveBids, placeNewBid, isConnected } =
    useAuctionSocket(auctionId);

  // Fetch initial auction details and bid history
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const details = await auctionService.getAuction(auctionId);
        setAuction(details);

        const history = await auctionService.getBids(auctionId);
        setBidsList(history);
      } catch (err) {
        toast.error("Failed to load auction room details");
        router.push("/auctions");
      } finally {
        setLoading(false);
      }
    };

    if (auctionId) {
      loadInitialData();
    }
  }, [auctionId, router]);

  // Sync state between REST details and WebSocket updates
  useEffect(() => {
    if (liveAuction) {
      setAuction(liveAuction);
    }
  }, [liveAuction]);

  // Append WebSocket live bids to list
  useEffect(() => {
    if (liveBids.length > 0) {
      const newLiveBid = liveBids[0];
      // Prevent duplicate rendering
      setBidsList((prev) => {
        if (
          prev.some(
            (b) =>
              b._id === newLiveBid._id ||
              (b.bidAmount === newLiveBid.bidAmount &&
                b.userId === newLiveBid.userId),
          )
        ) {
          return prev;
        }
        return [newLiveBid, ...prev];
      });
    }
  }, [liveBids]);

  // Countdown timer logic
  useEffect(() => {
    if (!auction || auction.status === "ended") {
      setTimeLeft("Ended");
      setTimeState("ended");
      return;
    }

    const updateTimer = () => {
      const diff = new Date(auction.endTime).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Ended");
        setTimeState("ended");
        setAuction((prev) => (prev ? { ...prev, status: "ended" } : null));
        return;
      }

      const totalMinutes = diff / (1000 * 60);
      if (totalMinutes < 1) {
        setTimeState("critical");
      } else if (totalMinutes < 5) {
        setTimeState("warning");
      } else {
        setTimeState("normal");
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      let timerStr = "";
      if (hours > 0) timerStr += `${hours}h `;
      timerStr += `${minutes}m ${seconds}s`;
      setTimeLeft(timerStr);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [auction]);

  // Auto scroll to top of bids feed on new bid
  useEffect(() => {
    bidsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bidsList]);

  const handlePlaceBid = (amount: number) => {
    if (!auction) return;
    if (auction.status === "ended") {
      toast.error("This auction has already ended.");
      return;
    }
    if (auction.farmerId === user?.id) {
      toast.error("You cannot bid on your own auction.");
      return;
    }
    if (user && user.balance !== undefined && user.balance < amount) {
      toast.error(`Insufficient balance. You need ${amount} credits.`);
      return;
    }
    if (amount <= auction.currentHighestBid) {
      toast.error(
        `Your bid must be higher than ${auction.currentHighestBid} credits.`,
      );
      return;
    }

    placeNewBid(amount);
    setCustomBid("");
  };

  const handleCustomBidSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const amount = Number(customBid);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive number");
      return;
    }
    handlePlaceBid(amount);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-12 flex flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-muted-foreground font-semibold">
          Connecting to Auction Room...
        </p>
      </div>
    );
  }

  if (!auction) return null;

  const currentBid = auction.currentHighestBid;
  const isFarmer = auction.farmerId === user?.id;

  const presetIncrements = [100, 500, 1000];

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto space-y-6 py-4">
        {/* Back Link & Breadcrumbs */}
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/auctions")}
            className="gap-1.5 text-muted-foreground hover:text-foreground font-semibold"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Live Auctions
          </Button>

          <Badge
            variant="outline"
            className={`gap-1.5 px-3 py-1 font-bold text-xs ${
              isConnected
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400"
            }`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isConnected ? "bg-emerald-400" : "bg-rose-400"}`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${isConnected ? "bg-emerald-500" : "bg-rose-500"}`}
              ></span>
            </span>
            {isConnected ? "LIVE ROOM SYNCED" : "DISCONNECTED"}
          </Badge>
        </div>

        {/* Bidding Grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Crop details card (Left Column) */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border border-border bg-card shadow-sm text-left">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
                <div className="flex items-center gap-2.5">
                  <div className="bg-primary/10 p-2 rounded-xl">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold capitalize">
                      {auction.batchDetails?.cropType} Batch
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {auction.batchId}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="py-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                      Initial Price
                    </p>
                    <p className="text-base font-bold font-mono text-foreground">
                      {auction.startPrice?.toLocaleString()} cr
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                      Crop Quantity
                    </p>
                    <p className="text-base font-bold text-foreground">
                      {auction.batchDetails?.quantity?.toLocaleString()} kg
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 border-t border-border/40 pt-4">
                  <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                    Harvest Origin
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {auction.batchDetails?.origin || "Unknown"}
                  </p>
                </div>

                {auction.batchDetails?.certifications && (
                  <div className="space-y-1.5 border-t border-border/40 pt-4">
                    <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />{" "}
                      Certifications
                    </p>
                    <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg w-fit">
                      {auction.batchDetails.certifications}
                    </p>
                  </div>
                )}

                {auction.batchDetails?.description && (
                  <div className="space-y-1.5 border-t border-border/40 pt-4">
                    <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                      Batch Description
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {auction.batchDetails.description}
                    </p>
                  </div>
                )}

                <div className="space-y-1.5 border-t border-border/40 pt-4">
                  <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                    Seller (Farmer)
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {auction.farmerName}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Interactive Bidding Board (Right 2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Countdown & Bidding Controls */}
            <Card className="border border-border bg-card shadow-sm text-left">
              <CardContent className="p-6 grid sm:grid-cols-2 gap-6 items-center">
                {/* Timer Display */}
                <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-2 border-b sm:border-b-0 sm:border-r border-border/40 pb-6 sm:pb-0 sm:pr-6">
                  <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
                    <Clock className="h-4 w-4" /> Remaining Time
                  </span>

                  <div
                    className={`text-4xl font-black font-mono tracking-tight transition-all duration-300 ${
                      timeState === "critical"
                        ? "text-rose-500 animate-pulse scale-105"
                        : timeState === "warning"
                          ? "text-amber-500"
                          : timeState === "ended"
                            ? "text-slate-400 dark:text-slate-600"
                            : "text-emerald-500"
                    }`}
                  >
                    {timeLeft}
                  </div>

                  <Badge
                    variant="outline"
                    className={`font-bold uppercase tracking-wider text-[10px] border ${
                      timeState === "critical"
                        ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                        : timeState === "warning"
                          ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                          : timeState === "ended"
                            ? "bg-slate-100 text-slate-500 border-slate-300/30 dark:bg-slate-800/40"
                            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                    }`}
                  >
                    {timeState === "critical"
                      ? "HURRY! Closing Soon"
                      : timeState === "warning"
                        ? "Closing Soon"
                        : timeState === "ended"
                          ? "Completed"
                          : "Bidding Active"}
                  </Badge>
                </div>

                {/* Bidding Control Panel */}
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                        Current High Bid
                      </p>
                      <p className="text-3xl font-black text-foreground font-mono mt-0.5 flex items-baseline gap-1">
                        {currentBid?.toLocaleString()}
                        <span className="text-xs text-muted-foreground font-normal font-sans">
                          credits
                        </span>
                      </p>
                    </div>
                    {auction.highestBidderName && (
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                          Top Bidder
                        </p>
                        <Badge
                          variant="outline"
                          className="mt-1 font-semibold border-primary/20 bg-primary/5 text-primary text-[11px]"
                        >
                          {auction.highestBidderName}
                        </Badge>
                      </div>
                    )}
                  </div>

                  {/* Bidding Buttons */}
                  {timeState !== "ended" ? (
                    isFarmer ? (
                      <div className="bg-muted p-4 rounded-xl border border-border text-center text-xs text-muted-foreground italic">
                        You created this auction. Farmers cannot bid on their
                        own crops.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* Quick Presets */}
                        <div className="grid grid-cols-3 gap-2">
                          {presetIncrements.map((inc) => {
                            const bidAmount = currentBid + inc;
                            return (
                              <Button
                                key={inc}
                                variant="outline"
                                size="sm"
                                onClick={() => handlePlaceBid(bidAmount)}
                                className="font-bold text-xs rounded-xl border-border/80 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-sm"
                              >
                                +{inc.toLocaleString()}
                              </Button>
                            );
                          })}
                        </div>

                        {/* Custom Bid Input */}
                        <form
                          onSubmit={handleCustomBidSubmit}
                          className="flex gap-2"
                        >
                          <input
                            type="number"
                            placeholder={`Enter min ${currentBid + 1}...`}
                            value={customBid}
                            onChange={(e) => setCustomBid(e.target.value)}
                            min={currentBid + 1}
                            className="flex-1 px-4 py-2 border border-border bg-muted/40 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary/45 font-mono text-sm"
                          />
                          <Button
                            type="submit"
                            className="bg-primary hover:bg-primary/95 text-primary-foreground font-bold shadow-md shadow-primary/10 rounded-xl px-6 h-10 text-xs shrink-0"
                          >
                            Place Bid
                          </Button>
                        </form>
                      </div>
                    )
                  ) : (
                    <div className="bg-muted p-4 rounded-xl border border-border text-center">
                      <p className="text-xs font-bold text-foreground">
                        Auction Complete
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {auction.highestBidder
                          ? `Sold to ${auction.highestBidderName || "Buyer"} for ${currentBid?.toLocaleString()} credits.`
                          : "No bids were placed on this batch."}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Live Bids Log Feed */}
            <Card className="border border-border bg-card shadow-sm text-left flex flex-col h-[400px] overflow-hidden">
              <CardHeader className="pb-3 border-b border-border/40 flex flex-row items-center justify-between shrink-0 bg-muted/10">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4.5 w-4.5 text-primary animate-bounce" />
                  <CardTitle className="text-sm font-bold uppercase tracking-wider">
                    Live Bid Stream
                  </CardTitle>
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  {bidsList.length} total bids
                </span>
              </CardHeader>

              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3.5">
                {bidsList.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-muted-foreground italic space-y-2 py-20">
                    <User className="h-8 w-8 text-muted-foreground/30" />
                    <span>
                      No bids placed yet. Be the first to place a bid!
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {/* Visual anchor for scrolling */}
                    <div ref={bidsEndRef} />

                    {bidsList.map((bid, index) => {
                      const isUserBid = bid.userId === user?.id;
                      const isHighestBid = index === 0;

                      return (
                        <div
                          key={bid._id}
                          className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 duration-200 ${
                            isHighestBid
                              ? "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 ring-1 ring-amber-500/10"
                              : "bg-muted/30 border-border/60 hover:bg-muted/40"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {/* User Initial Circle */}
                            <div
                              className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-black border ${
                                isHighestBid
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600"
                                  : "bg-primary/10 border-primary/20 text-primary"
                              }`}
                            >
                              {bid.userName?.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                {bid.userName}
                                {isUserBid && (
                                  <Badge className="text-[9px] px-1 py-0 bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 font-bold uppercase select-none rounded">
                                    You
                                  </Badge>
                                )}
                                {isHighestBid && (
                                  <Badge className="text-[9px] px-1 py-0 bg-amber-500 text-slate-950 font-bold uppercase select-none rounded animate-pulse">
                                    Top Bid
                                  </Badge>
                                )}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {new Date(bid.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <p
                              className={`text-base font-black font-mono tracking-tight ${
                                isHighestBid
                                  ? "text-amber-600 dark:text-amber-400"
                                  : "text-foreground/80"
                              }`}
                            >
                              {bid.bidAmount?.toLocaleString()}
                              <span className="text-[10px] text-muted-foreground font-normal font-sans ml-0.5">
                                cr
                              </span>
                            </p>
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
    </ProtectedRoute>
  );
}
