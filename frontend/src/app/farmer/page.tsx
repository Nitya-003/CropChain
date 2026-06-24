"use client";
import React, { useState, useEffect, useCallback } from 'react';
import { Leaf, Package, Plus, RefreshCw, TrendingUp, Clock, MapPin, Eye } from 'lucide-react';
import Link from 'next/link';
import { realCropBatchService } from '../../services/realCropBatchService';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../../components/ui/table';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import BatchFilters from '../../components/BatchFilters';

const FarmerDashboardComponent: React.FC = () => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBatches: 0,
    totalQuantity: 0,
    activeBatches: 0,
  });

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

  const loadBatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiFilters: any = {};
      Object.entries(filters).forEach(([key, val]) => {
        if (val !== undefined && val !== '') {
          apiFilters[key] = val;
        }
      });
      if (user?.name) {
        apiFilters.farmerName = user.name;
      }

      const data = await realCropBatchService.getAllBatches(apiFilters);
      const allBatches: any[] = data?.batches || [];

      setBatches(allBatches);
      setStats({
        totalBatches: allBatches.length,
        totalQuantity: allBatches.reduce((sum: number, b: any) => sum + (b.quantity || 0), 0),
        activeBatches: allBatches.filter((b: any) => b.currentStage !== 'retailer').length,
      });
      if (data?.pagination) {
        setPagination({
          totalItems: data.pagination.totalItems || 0,
          currentPage: data.pagination.currentPage || 1,
          totalPages: data.pagination.totalPages || 1,
          limit: data.pagination.limit || 10
        });
      }
    } catch (error) {
      console.error('Failed to load batches:', error);
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
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300 border-indigo-300/30';
      case 'mandi':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-300/30';
      case 'transport':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300/30';
      case 'retailer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300/30';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-700/30';
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
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Farmer Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, <span className="font-semibold text-foreground">{user?.name || 'Farmer'}</span> — manage your crop batches
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadBatches} className="gap-1.5 bg-background/50">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Link href="/add-batch">
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              New Batch
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">My Batches</span>
            <div className="bg-indigo-500/10 p-2 rounded-xl">
              <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-left">
            <div className="text-3xl font-bold tracking-tight">{isLoading ? <div className="h-9 w-16 bg-muted animate-pulse rounded" /> : stats.totalBatches}</div>
            <p className="text-xs text-muted-foreground">Total batches created</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Quantity</span>
            <div className="bg-emerald-500/10 p-2 rounded-xl">
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-left">
            <div className="text-3xl font-bold tracking-tight">{isLoading ? <div className="h-9 w-24 bg-muted animate-pulse rounded" /> : <>{stats.totalQuantity.toLocaleString()} <span className="text-lg font-medium text-muted-foreground">kg</span></>}</div>
            <p className="text-xs text-muted-foreground">Cumulative crop quantity</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">In Transit</span>
            <div className="bg-amber-500/10 p-2 rounded-xl">
              <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-left">
            <div className="text-3xl font-bold tracking-tight">{isLoading ? <div className="h-9 w-16 bg-muted animate-pulse rounded" /> : stats.activeBatches}</div>
            <p className="text-xs text-muted-foreground">Batches still in supply chain</p>
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
                <p className="font-semibold text-foreground">Create New Batch</p>
                <p className="text-sm text-muted-foreground">Register a new crop harvest on the blockchain</p>
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
                <p className="font-semibold text-foreground">Track Batch</p>
                <p className="text-sm text-muted-foreground">Monitor batch journey through the supply chain</p>
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
            onFilterChange={(partial) => setFilters(f => ({ ...f, ...partial }))}
            onSearchSubmit={(search) => setFilters(f => ({ ...f, search, page: 1 }))}
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
            <CardTitle className="text-lg font-semibold text-foreground">My Batches</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="bg-muted p-4 rounded-full">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Loading...</p>
              </div>
            </div>
          ) : batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="bg-muted p-4 rounded-full">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-foreground">No batches found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or create a new batch</p>
              </div>
              <Link href="/add-batch">
                <Button size="sm" className="gap-1.5 mt-2">
                  <Plus className="h-3.5 w-3.5" />
                  Create Batch
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/40">
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Batch ID</TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Crop Type</TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Quantity</TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Origin</TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Current Stage</TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.batchId} className="border-b border-border/40 hover:bg-muted/30 transition-colors text-left">
                      <TableCell className="py-4 px-6">
                        <span className="font-mono text-xs bg-muted text-muted-foreground px-2 py-1 rounded border border-border">
                          {batch.batchId?.slice(0, 8)}...{batch.batchId?.slice(-4)}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <span className="capitalize font-medium text-foreground text-sm">{batch.cropType}</span>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <span className="font-medium text-foreground text-sm">{batch.quantity?.toLocaleString()} kg</span>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <span className="text-sm text-muted-foreground">{batch.origin}</span>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant="outline" className={`capitalize font-semibold border ${getStageColor(batch.currentStage)}`}>
                          {batch.currentStage}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Link href={`/track-batch?id=${batch.batchId}`}>
                          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-border/40 py-4 px-6">
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
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default function FarmerDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['farmer']}>
      <FarmerDashboardComponent />
    </ProtectedRoute>
  );
}
