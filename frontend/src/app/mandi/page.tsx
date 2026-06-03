"use client";
import React, { useState, useEffect } from 'react';
import { Factory, Search, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { realCropBatchService } from '../../services/realCropBatchService';
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import ProtectedRoute from '../../components/ProtectedRoute';

const MandiDashboardComponent: React.FC = () => {
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
        // Show batches that are relevant to mandi (either waiting at farmer or already at mandi)
        const mandiBatches = data.batches.filter((b: any) => 
          ['farmer', 'mandi'].includes(b.currentStage?.toLowerCase())
        );
        setBatches(mandiBatches);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptBatch = async (batchId: string) => {
    setUpdatingId(batchId);
    try {
      await realCropBatchService.updateBatch(batchId, {
        currentStage: 'mandi',
        // Depending on backend implementation we might send location updates or timestamps here
      });
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to update batch:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case 'farmer':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-300/30';
      case 'mandi':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-300/30';
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

  const pendingCount = batches.filter(b => b.currentStage?.toLowerCase() === 'farmer').length;
  const acceptedCount = batches.filter(b => b.currentStage?.toLowerCase() === 'mandi').length;

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-6 px-4 sm:px-6 lg:px-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-500/10 p-3 rounded-2xl">
            <Factory className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Mandi Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage incoming crop batches and market approvals</p>
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
              <p className="text-sm font-medium text-muted-foreground mb-1">Pending Approval</p>
              <h2 className="text-3xl font-bold text-foreground">{pendingCount}</h2>
            </div>
            <div className="bg-amber-500/10 p-4 rounded-full">
              <Clock className="h-6 w-6 text-amber-600" />
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border bg-card">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Accepted at Mandi</p>
              <h2 className="text-3xl font-bold text-foreground">{acceptedCount}</h2>
            </div>
            <div className="bg-blue-500/10 p-4 rounded-full">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border bg-card shadow-sm h-full">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Incoming Batches</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {batches.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
              <Factory className="h-12 w-12 mb-3 text-muted" />
              <p>No relevant batches found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Batch ID</TableHead>
                    <TableHead className="py-4 px-6 font-semibold text-foreground text-left">Farmer</TableHead>
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
                      <TableCell className="py-4 px-6 font-medium text-foreground">
                        {batch.farmerName || 'Unknown Farmer'}
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <span className="capitalize text-muted-foreground">{batch.cropType}</span>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-muted-foreground">
                        {batch.quantity.toLocaleString()} kg
                      </TableCell>
                      <TableCell className="py-4 px-6">
                        <Badge variant="outline" className={`capitalize font-medium border ${getStageColor(batch.currentStage)}`}>
                          {batch.currentStage === 'farmer' ? 'Pending Acceptance' : 'At Mandi'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4 px-6 text-right">
                        {batch.currentStage?.toLowerCase() === 'farmer' ? (
                          <Button 
                            size="sm" 
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={() => handleAcceptBatch(batch.batchId || batch._id)}
                            disabled={updatingId === (batch.batchId || batch._id)}
                          >
                            {updatingId === (batch.batchId || batch._id) ? 'Accepting...' : 'Accept Batch'}
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground italic mr-2">Ready for transport</span>
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

export default function MandiDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['mandi']}>
      <MandiDashboardComponent />
    </ProtectedRoute>
  );
}
