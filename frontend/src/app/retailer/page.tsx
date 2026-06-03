"use client";
import React, { useState, useEffect } from 'react';
import { Store, RefreshCw, ShoppingCart, Tag, CheckCircle } from 'lucide-react';
import { realCropBatchService } from '../../services/realCropBatchService';
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import ProtectedRoute from '../../components/ProtectedRoute';

const RetailerDashboardComponent: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const data = await realCropBatchService.getAllBatches();
      if (data && data.batches) {
        // Show batches that are delivered to retailer or sold
        const retailerBatches = data.batches.filter((b: any) => 
          ['retailer', 'sold'].includes(b.currentStage?.toLowerCase())
        );
        setBatches(retailerBatches);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsSold = async (batchId: string) => {
    setUpdatingId(batchId);
    try {
      await realCropBatchService.updateBatch(batchId, {
        currentStage: 'sold',
      });
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to mark as sold:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case 'retailer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-300/30';
      case 'sold':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300/30';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-700/30';
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse py-6 px-4">
        <div className="h-10 bg-muted rounded-lg w-64"></div>
        <Card className="border-border bg-card"><CardHeader className="h-64"></CardHeader></Card>
      </div>
    );
  }

  const receivedCount = batches.filter(b => b.currentStage?.toLowerCase() === 'retailer').length;
  const soldCount = batches.filter(b => b.currentStage?.toLowerCase() === 'sold').length;

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-6 px-4 sm:px-6 lg:px-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-purple-500/10 p-3 rounded-2xl">
            <Store className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Retailer Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage your received inventory and sales</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboardData} className="gap-1.5 bg-background/50">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="border border-border bg-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">In Stock</p>
              <h2 className="text-3xl font-bold text-foreground">{receivedCount}</h2>
            </div>
            <div className="bg-purple-500/10 p-4 rounded-full">
              <ShoppingCart className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Batches Sold</p>
              <h2 className="text-3xl font-bold text-foreground">{soldCount}</h2>
            </div>
            <div className="bg-emerald-500/10 p-4 rounded-full">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card shadow-sm h-full">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Inventory</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {batches.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
              <Store className="h-12 w-12 mb-3 text-muted" />
              <p>No inventory received yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Batch ID</TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Crop</TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Quantity</TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Status</TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((batch) => (
                    <TableRow key={batch.batchId || batch._id} className="border-b border-border/40 hover:bg-muted/20 text-left transition-colors">
                      <TableCell className="py-4 px-6">
                        <span className="font-mono text-xs bg-muted text-muted-foreground px-2 py-1 rounded border border-border">
                          {(batch.batchId || batch._id || '').slice(0, 8)}...
                        </span>
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <span className="capitalize font-medium text-foreground">{batch.cropType}</span>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-muted-foreground">
                        {batch.quantity.toLocaleString()} kg
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant="outline" className={`capitalize font-medium border ${getStageColor(batch.currentStage)}`}>
                          {batch.currentStage === 'retailer' ? 'In Stock' : 'Sold'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right">
                        {batch.currentStage?.toLowerCase() === 'retailer' ? (
                          <Button 
                            size="sm" 
                            className="bg-purple-600 hover:bg-purple-700 text-white"
                            onClick={() => handleMarkAsSold(batch.batchId || batch._id)}
                            disabled={updatingId === (batch.batchId || batch._id)}
                          >
                            {updatingId === (batch.batchId || batch._id) ? 'Updating...' : 'Mark as Sold'}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic flex items-center justify-end gap-1">
                            <Tag className="h-3 w-3" /> Sold Out
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default function RetailerDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['retailer']}>
      <RetailerDashboardComponent />
    </ProtectedRoute>
  );
}
