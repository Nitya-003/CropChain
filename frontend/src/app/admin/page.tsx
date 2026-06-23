"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Shield, Package, Coins, Activity, TrendingUp, Check, Copy, RefreshCw } from 'lucide-react';
import StatsCardSkeleton from '../../components/skeletons/StatsCardSkeleton';
import TableSkeleton from '../../components/skeletons/TableSkeleton';
import { realCropBatchService } from '../../services/realCropBatchService';
import { usePriceConverter } from '../../hooks/usePriceConverter';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../../components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import ProtectedRoute from '../../components/ProtectedRoute';
import BatchFilters from '../../components/BatchFilters';

const AdminDashboardComponent: React.FC = () => {
  const [stats, setStats] = useState({
    totalBatches: 0,
    totalFarmers: 0,
    totalQuantity: 0,
    recentBatches: []
  });
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { convert, isLoading: isPricesLoading } = usePriceConverter();
  const [selected, setSelected] = useState<string[]>([]);

  const toggleSelect = (batchId: string) => {
    setSelected(prev =>
      prev.includes(batchId)
        ? prev.filter(id => id !== batchId)
        : prev.length < 4 ? [...prev, batchId] : prev
    );
  };

  const [filters, setFilters] = useState({
    search: '',
    stage: '',
    cropType: '',
    status: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });

  const [pagination, setPagination] = useState({
    totalItems: 0,
    currentPage: 1,
    totalPages: 1,
    limit: 10
  });

  const [searchInput, setSearchInput] = useState('');

  const activeCount = Object.entries(filters).filter(([key, val]) => {
    if (key === 'sortBy' && val === 'createdAt') return false;
    if (key === 'sortOrder' && val === 'desc') return false;
    if (key === 'page' && val === 1) return false;
    if (key === 'limit' && val === 10) return false;
    return val !== '';
  }).length;

  useEffect(() => {
    loadDashboardData();
  }, [filters]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const apiFilters: any = {};
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== '') {
          apiFilters[key] = val;
        }
      });

      const data = await realCropBatchService.getAllBatches(apiFilters);
      if (data) {
        setStats(data.stats || { totalBatches: 0, totalFarmers: 0, totalQuantity: 0, recentBatches: [] });
        setBatches(data.batches || []);
        if (data.pagination) {
          setPagination({
            totalItems: data.pagination.totalItems || 0,
            currentPage: data.pagination.currentPage || 1,
            totalPages: data.pagination.totalPages || 1,
            limit: data.pagination.limit || 10
          });
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFilters(f => ({ ...f, search: searchInput, page: 1 }));
  };

  const clearFilters = () => {
    setSearchInput('');
    setFilters({
      search: '',
      stage: '',
      cropType: '',
      status: '',
      dateFrom: '',
      dateTo: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      page: 1,
      limit: 10
    });
  };

  const getStageColor = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case 'farmer':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300/30';
      case 'mandi':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300/30';
      case 'transport':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300/30';
      case 'retailer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300/30';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-700/30';
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 py-6">
        <div className="text-center space-y-3">
          <div className="h-10 bg-muted rounded-lg w-64 mx-auto animate-pulse"></div>
          <div className="h-5 bg-muted rounded-lg w-96 mx-auto animate-pulse"></div>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
        <div className="border border-border bg-card rounded-xl p-6">
          <div className="h-6 bg-muted rounded w-48 mb-6 animate-pulse"></div>
          <TableSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-4">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-3 rounded-2xl">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground">Monitor and manage the CropChain supply chain network</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selected.length >= 2 && (
            <Link href={`/compare?ids=${selected.join(',')}`}>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 h-9">
                Compare {selected.length} batches
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={loadDashboardData} className="gap-1.5 bg-background/50">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Stats
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Batches</span>
            <div className="bg-emerald-500/10 p-2 rounded-xl">
              <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-left">
            <div className="text-3xl font-bold tracking-tight">{stats.totalBatches}</div>
            <div className="flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <TrendingUp className="h-3.5 w-3.5 mr-1" />
              <span>+12% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Batch Value</span>
            <div className="bg-indigo-500/10 p-2 rounded-xl">
              <Coins className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-left">
            <div className="text-3xl font-bold tracking-tight">
              {isPricesLoading ? (
                <div className="h-9 w-24 bg-muted animate-pulse rounded mt-1"></div>
              ) : (
                convert(stats.totalQuantity * 0.05, 'MATIC')
              )}
            </div>
            <div className="flex items-center text-xs text-muted-foreground font-medium">
              <TrendingUp className="h-3.5 w-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
              <span>Based on {stats.totalQuantity.toLocaleString()} kg</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Estimated Gas Fees</span>
            <div className="bg-rose-500/10 p-2 rounded-xl">
              <Activity className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-left">
            <div className="text-3xl font-bold tracking-tight">
              {isPricesLoading ? (
                <div className="h-9 w-24 bg-muted animate-pulse rounded mt-1"></div>
              ) : (
                convert(stats.totalBatches * 0.002, 'ETH')
              )}
            </div>
            <div className="flex items-center text-xs text-muted-foreground font-medium">
              <span className="text-rose-600 dark:text-rose-400">Network Average Gas Fee</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Section */}
      <Card className="border border-border bg-card/60 backdrop-blur-md shadow-sm">
        <CardContent className="p-6">
          <BatchFilters
            filters={filters}
            onFilterChange={(partial) => setFilters(f => ({ ...f, ...partial }))}
            onSearchSubmit={(search) => setFilters(f => ({ ...f, search: search, page: 1 }))}
            onClearFilters={clearFilters}
            searchInput={searchInput}
            onSearchInputChange={setSearchInput}
            activeFilterCount={activeCount}
          />
        </CardContent>
      </Card>

      {/* Recent Batches Section */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-semibold text-foreground">Recent Batches</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/40">
                  <TableHead className="py-4 px-6 font-semibold text-foreground text-left w-[60px]">Select</TableHead>
                  <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Batch ID</TableHead>
                  <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Farmer</TableHead>
                  <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Crop Type</TableHead>
                  <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Quantity</TableHead>
                  <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Current Stage</TableHead>
                  <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Tx Value</TableHead>
                  <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.batchId} className="border-b border-border/40 hover:bg-muted/30 transition-colors text-left">
                    <TableCell className="py-4 px-6">
                      <input
                        type="checkbox"
                        checked={selected.includes(batch.batchId)}
                        onChange={() => toggleSelect(batch.batchId)}
                        className="h-4 w-4 rounded border-gray-300 dark:border-gray-700 bg-transparent text-primary focus:ring-green-500 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs bg-muted text-muted-foreground px-2 py-1 rounded border border-border">
                          {batch.batchId.slice(0, 8)}...{batch.batchId.slice(-4)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyToClipboard(batch.batchId)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title={copiedId === batch.batchId ? 'Copied!' : 'Copy Batch ID'}
                        >
                          {copiedId === batch.batchId ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div>
                        <p className="font-medium text-foreground text-sm">{batch.farmerName}</p>
                        <p className="text-xs text-muted-foreground">{batch.origin}</p>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <span className="capitalize font-medium text-foreground text-sm">{batch.cropType}</span>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <span className="font-medium text-foreground text-sm">{batch.quantity.toLocaleString()} kg</span>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <Badge variant="outline" className={`capitalize font-semibold border ${getStageColor(batch.currentStage)}`}>
                        {batch.currentStage}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="text-foreground text-sm font-medium">
                        {isPricesLoading ? (
                          <div className="h-4 w-16 bg-muted animate-pulse rounded"></div>
                        ) : (
                          convert(batch.quantity * 0.05, 'MATIC')
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between border-t border-border/40 py-4 px-6">
          <p className="text-xs text-muted-foreground">
            Showing {batches.length} of {pagination.totalItems} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.currentPage <= 1 || isLoading}
              onClick={() => setFilters(f => ({ ...f, page: pagination.currentPage - 1 }))}
              className="h-8 rounded-lg text-xs"
            >
              Previous
            </Button>
            <span className="text-xs font-semibold text-foreground">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.currentPage >= pagination.totalPages || isLoading}
              onClick={() => setFilters(f => ({ ...f, page: pagination.currentPage + 1 }))}
              className="h-8 rounded-lg text-xs"
            >
              Next
            </Button>
          </div>
        </CardFooter>
      </Card>

      {/* Analytics Charts Section */}
      <div className="grid md:grid-cols-2 gap-6 text-left">
        <Card className="border border-border bg-card">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Crop Distribution</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {['Rice', 'Wheat', 'Corn', 'Tomato'].map((crop, index) => {
              const percentages = [35.4, 28.2, 21.1, 15.3];
              const percentage = percentages[index];
              return (
                <div key={crop} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground">{crop}</span>
                    <span className="text-foreground">{percentage}%</span>
                  </div>
                  <div className="bg-muted rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        index === 0 ? 'bg-emerald-500' :
                        index === 1 ? 'bg-blue-500' :
                        index === 2 ? 'bg-amber-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="border-b border-border/40 pb-3">
            <CardTitle className="text-base font-semibold text-foreground">Monthly Network Activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-end justify-between h-48 px-4 pt-4">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((month, index) => {
                const heights = [60, 95, 80, 110, 135, 120];
                const height = heights[index];
                return (
                  <div key={month} className="flex flex-col items-center gap-2 group flex-1">
                    <div className="relative w-full flex justify-center">
                      <div
                        className="bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md w-8 transition-all duration-300 group-hover:from-emerald-500 group-hover:to-emerald-300"
                        style={{ height: `${height}px` }}
                      ></div>
                    </div>
                    <span className="text-xs text-muted-foreground font-semibold">{month}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function AdminDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminDashboardComponent />
    </ProtectedRoute>
  );
}
