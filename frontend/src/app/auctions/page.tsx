"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Compass, Coins, Play, Trophy, Clock, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuth } from '../../context/AuthContext';
import { auctionService, Auction } from '../../services/auctionService';

import MarketplaceFilters, { MarketplaceFilterState } from '../../components/marketplace/MarketplaceFilters';
import MarketplaceFilterDrawer from '../../components/marketplace/MarketplaceFilterDrawer';
import { buildMarketplaceChips, MarketplaceFilterChips } from '../../components/marketplace/MarketplaceFilterChips';

const AuctionCard: React.FC<{ auction: Auction }> = ({ auction }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isEnded, setIsEnded] = useState<boolean>(auction.status === 'ended');

  useEffect(() => {
    if (isEnded) {
      setTimeLeft('Ended');
      return;
    }

    const calculateTimeLeft = () => {
      const difference = new Date(auction.endTime).getTime() - Date.now();
      if (difference <= 0) {
        setTimeLeft('Ended');
        setIsEnded(true);
        return;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      let timeString = '';
      if (hours > 0) timeString += `${hours}h `;
      timeString += `${minutes}m ${seconds}s`;
      setTimeLeft(timeString);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [auction.endTime, isEnded]);

  const progressPercentage = () => {
    const start = new Date(auction.startTime).getTime();
    const end = new Date(auction.endTime).getTime();
    const total = end - start;
    const elapsed = Date.now() - start;
    if (elapsed >= total) return 100;
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  };

  const getCropEmoji = (cropType: string) => {
    switch (cropType?.toLowerCase()) {
      case 'rice':
        return '🌾';
      case 'wheat':
        return '🌾';
      case 'corn':
        return '🌽';
      case 'tomato':
        return '🍅';
      default:
        return '🌱';
    }
  };

  return (
    <Card className="border border-border bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group overflow-hidden">
      {!isEnded && (
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500" />
      )}
      {isEnded && <div className="h-1.5 w-full bg-slate-300 dark:bg-slate-700" />}

      <CardHeader className="pb-3 text-left">
        <div className="flex justify-between items-start">
          <Badge variant="outline" className="text-xl px-2 py-0.5 rounded-xl border-none select-none">
            {getCropEmoji(auction.batchDetails?.cropType || '')}
          </Badge>
          <Badge
            variant="outline"
            className={`font-semibold capitalize text-xs tracking-wider border ${
              isEnded
                ? 'bg-slate-100 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400 border-slate-300/30'
                : 'bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse'
            }`}
          >
            {isEnded ? 'Auction Ended' : 'Live Auction'}
          </Badge>
        </div>

        <div className="mt-2 space-y-1">
          <CardTitle className="text-lg font-bold text-foreground capitalize flex items-center gap-1.5">
            {auction.batchDetails?.cropType || 'Crop Batch'}
            <span className="text-xs text-muted-foreground font-normal">({auction.batchId})</span>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Farmer: <span className="font-semibold text-foreground">{auction.farmerName}</span>
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 text-left pb-4">
        <div className="grid grid-cols-2 gap-2 text-xs bg-muted/40 p-2.5 rounded-xl border border-border/40">
          <div>
            <p className="text-muted-foreground">Quantity</p>
            <p className="font-semibold text-foreground mt-0.5">
              {auction.batchDetails?.quantity?.toLocaleString() || 0} kg
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Origin</p>
            <p className="font-semibold text-foreground mt-0.5 truncate">
              {auction.batchDetails?.origin || 'Unknown'}
            </p>
          </div>
        </div>

        {!isEnded && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Time Left:
              </span>
              <span className="text-amber-600 dark:text-amber-400 font-mono">{timeLeft}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-1000"
                style={{ width: `${progressPercentage()}%` }}
              />
            </div>
          </div>
        )}

        {isEnded && (
          <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
            <Clock className="h-3.5 w-3.5" /> Auction completed
          </div>
        )}

        <div className="flex justify-between items-end border-t border-border/40 pt-3">
          <div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              {isEnded ? 'Final Price' : 'Current Highest Bid'}
            </p>
            <p className="text-2xl font-black text-foreground font-mono mt-0.5 flex items-baseline gap-1">
              {auction.currentHighestBid?.toLocaleString() || 0}
              <span className="text-xs text-muted-foreground font-normal font-sans">credits</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Bidder</p>
            <p className="text-xs font-semibold text-foreground mt-1 truncate max-w-[120px]">
              {auction.highestBidderName || (
                <span className="text-muted-foreground italic text-[11px]">No bids yet</span>
              )}
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0 pb-5 px-6">
        <Link href={`/auctions/${auction._id}`} className="w-full">
          <Button
            className={`w-full font-semibold rounded-xl group transition-all duration-300 ${
              isEnded
                ? 'bg-muted hover:bg-muted text-muted-foreground cursor-not-allowed border border-border/60 shadow-none'
                : 'bg-primary hover:bg-primary/95 text-primary-foreground shadow-md shadow-primary/10 hover:shadow-lg'
            }`}
            variant={isEnded ? 'outline' : 'default'}
          >
            {isEnded ? (
              <span className="flex items-center justify-center gap-1.5">
                <Trophy className="h-4 w-4" /> View Results
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <Play className="h-4 w-4 fill-current group-hover:scale-105 transition-transform" />
                Enter Auction Room
              </span>
            )}
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default function AuctionsPage() {
  const { user, addFunds } = useAuth();

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'ended'>('all');

  // Top up simulator (existing UI)
  const [topUpAmount, setTopUpAmount] = useState<number>(10000);
  const [topUpLoading, setTopUpLoading] = useState<boolean>(false);

  const defaultFilterState: MarketplaceFilterState = {
    productCategory: '',
    priceMin: '',
    priceMax: '',
    location: '',
    availability: '',
    sortBy: 'latest',
  };
      return;
    }
    setTopUpLoading(true);
    try {
      await addFunds(topUpAmount);
    } catch (err) {
      // toast notification handled in AuthContext
    } finally {
      setTopUpLoading(false);
    }
  };

  const [filtersOpen, setFiltersOpen] = useState(false);

  const defaultFilterState: MarketplaceFilterState = {
    productCategory: '',
    priceMin: '',
    priceMax: '',
    location: '',
    availability: '',
    sortBy: 'latest',
  };

  const [filters, setFilters] = useState<MarketplaceFilterState>(defaultFilterState);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.productCategory) count++;
    if (filters.priceMin !== '') count++;
    if (filters.priceMax !== '') count++;
    if (filters.location) count++;
    if (filters.availability) count++;
    return count;
  }, [filters]);

  const clearAllFilters = () => {
    setFilters(defaultFilterState);
  };

  const removeFilter = {
    category: () => setFilters((f) => ({ ...f, productCategory: '' })),
    priceMin: () => setFilters((f) => ({ ...f, priceMin: '' })),
    priceMax: () => setFilters((f) => ({ ...f, priceMax: '' })),
    location: () => setFilters((f) => ({ ...f, location: '' })),
    availability: () => setFilters((f) => ({ ...f, availability: '' })),
  };

  const filteredAuctions = useMemo(() => {
    let list = auctions.filter((auction) => {
      if (activeTab === 'all') return true;
      return auction.status === activeTab;
    });

    const min = filters.priceMin === '' ? undefined : Number(filters.priceMin);
    const max = filters.priceMax === '' ? undefined : Number(filters.priceMax);

    list = list.filter((auction) => {
      if (filters.productCategory) {
        const cat = auction.batchDetails?.cropType || '';
        if (String(cat).toLowerCase() !== String(filters.productCategory).toLowerCase()) return false;
      }

      const price = Number(auction.currentHighestBid || 0);
      if (min !== undefined && !Number.isNaN(min) && price < min) return false;
      if (max !== undefined && !Number.isNaN(max) && price > max) return false;

      if (filters.location) {
        const origin = auction.batchDetails?.origin || '';
        if (!String(origin).toLowerCase().includes(String(filters.location).toLowerCase())) return false;
      }

      if (filters.availability) {
        if (auction.status !== filters.availability) return false;
      }

      return true;
    });

    const sorted = [...list];
    const getLatestTs = (a: Auction) => {
      const t = a.endTime || a.startTime;
      return t ? new Date(t as any).getTime() : 0;
    };

    switch (filters.sortBy) {
      case 'price_asc':

        sorted.sort((a, b) => Number(a.currentHighestBid || 0) - Number(b.currentHighestBid || 0));
        break;
      case 'price_desc':
        sorted.sort((a, b) => Number(b.currentHighestBid || 0) - Number(a.currentHighestBid || 0));
        break;
      case 'popular':
        sorted.sort((a, b) => Number((b as any).popularity ?? b.totalBids ?? 0) - Number((a as any).popularity ?? a.totalBids ?? 0));
        break;
      case 'latest':
      default:
        sorted.sort((a, b) => getLatestTs(b) - getLatestTs(a));
        break;
    }

    return sorted;
  }, [auctions, activeTab, filters]);
+

  const chips = useMemo(
+    () =>
+      buildMarketplaceChips(filters, {
+        category: removeFilter.category,
+        priceMin: removeFilter.priceMin,
+        priceMax: removeFilter.priceMax,
+        location: removeFilter.location,
+        availability: removeFilter.availability,
+      }),
+    [filters]
+  );


  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto space-y-8 py-4">
        {/* Header Hero Section */}
        <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950/20 p-8 sm:p-10 text-white shadow-lg">
          <div className="absolute top-0 right-0 -z-10 h-full w-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
          
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-4 text-left md:max-w-2xl">
              <Badge variant="outline" className="px-3 py-1 bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold text-xs tracking-wider">
                <Compass className="h-3.5 w-3.5 mr-1.5 animate-spin" /> LIVE BIDDING PORTAL
              </Badge>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Real-Time Crop Auctions
              </h1>
              <p className="text-slate-300 text-sm leading-relaxed">
                Maximize profits for farmers and secure high-quality crop batches as buyers. Bid live, lock transaction contracts atomically, and watch market updates instantly.
              </p>
            </div>

            {/* Account balance / mock funds top up panel */}
            <div className="w-full md:w-80 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-5 space-y-4 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-amber-400" /> Account Balance:
                </span>
                <span className="text-lg font-black text-amber-400 font-mono">
                  {user?.balance?.toLocaleString() || 0} cr
                </span>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top Up Simulator Balance</p>
                <div className="flex gap-2">
                  <select 
                    value={topUpAmount} 
                    onChange={(e) => setTopUpAmount(Number(e.target.value))}
                    className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none"
                  >
                    <option value={1000}>1,000 credits</option>
                    <option value={5000}>5,000 credits</option>
                    <option value={10000}>10,000 credits</option>
                    <option value={50000}>50,000 credits</option>
                    <option value={100000}>100,000 credits</option>
                  </select>
                  <Button 
                    size="sm" 
                    onClick={handleTopUp} 
                    disabled={topUpLoading}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shrink-0"
                  >
                    {topUpLoading ? 'Adding...' : 'Top Up'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Filters and Refresh */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div className="flex gap-1 bg-muted/65 dark:bg-muted/20 p-1 rounded-full border border-border/40 shadow-inner">
            {(['all', 'active', 'ended'] as const).map((tab) => (
              <Button
                key={tab}
                variant={activeTab === tab ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(tab)}
                className={`text-xs font-bold rounded-full capitalize px-5 h-8 ${
                  activeTab === tab 
                    ? 'bg-primary text-primary-foreground shadow' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'all' ? 'All Auctions' : tab === 'active' ? 'Live Now' : 'Completed'}
              </Button>
            ))}
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchAuctions} 
            className="gap-1.5 h-9 rounded-xl bg-background/50 text-xs font-bold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Auctions Grid */}
        {loading && auctions.length === 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-border bg-card h-80" />
            ))}
          </div>
        ) : filteredAuctions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4 bg-muted/20 rounded-3xl border border-dashed border-border p-8">
            <div className="bg-muted p-4 rounded-full text-muted-foreground">
              <Compass className="h-10 w-10" />
            </div>
            <div>
              <p className="font-semibold text-lg text-foreground">No auctions found</p>
              <p className="text-sm text-muted-foreground mt-1">There are no {activeTab !== 'all' ? activeTab : ''} auctions available right now.</p>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAuctions.map((auction) => (
              <AuctionCard key={auction._id} auction={auction} />
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
