"use client";
import React, { useState, useEffect } from 'react';
import { Package, Plus, Search, RefreshCw, Factory, Truck, Store, MapPin } from 'lucide-react';
import { realCropBatchService } from '../../services/realCropBatchService';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/table";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import ProtectedRoute from '../../components/ProtectedRoute';

const FarmerDashboardComponent: React.FC = () => {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  
  // Form state
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    cropType: '',
    quantity: '',
    origin: ''
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const data = await realCropBatchService.getAllBatches();
      if (data && data.batches) {
        // Only show this farmer's batches based on farmerName for now 
        // (ideally should be farmerId, but user object contains name and id)
        const farmerBatches = data.batches.filter((b: any) => 
          b.farmerName === user?.name || b.farmerId === user?.id
        );
        setBatches(farmerBatches.length > 0 ? farmerBatches : data.batches); // Fallback to all if matching fails during dev
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cropType || !formData.quantity || !formData.origin) return;
    
    setIsCreating(true);
    try {
      await realCropBatchService.createBatch({
        ...formData,
        quantity: Number(formData.quantity),
        cropType: formData.cropType.toLowerCase(),
        farmerId: user?.id || 'unknown',
        farmerName: user?.name || 'Unknown Farmer',
        farmerAddress: formData.origin,
        harvestDate: new Date().toISOString()
      });
      // Reset form and reload
      setFormData({ cropType: 'wheat', quantity: '', origin: '' });
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to create batch:', error);
    } finally {
      setIsCreating(false);
    }
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

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8 animate-pulse py-6 px-4">
        <div className="h-10 bg-muted rounded-lg w-64"></div>
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-border bg-card"><CardHeader className="h-48"></CardHeader></Card>
          <Card className="border-border bg-card"><CardHeader className="h-48"></CardHeader></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 py-6 px-4 sm:px-6 lg:px-8">
      {/* Title */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-500/10 p-3 rounded-2xl">
            <Package className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-left">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Farmer Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage your crop batches and track their journey</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadDashboardData} className="gap-1.5 bg-background/50">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Create Batch Form */}
        <Card className="border border-border bg-card shadow-sm h-fit">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-lg font-semibold">Create New Batch</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleCreateBatch} className="space-y-4">
              <div className="space-y-2 text-left">
                <label className="text-sm font-medium text-foreground">Crop Type</label>
                <select 
                  value={formData.cropType}
                  onChange={e => setFormData({...formData, cropType: e.target.value})}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" 
                  required
                >
                  <option value="">Select a crop...</option>
                  <option value="wheat">Wheat</option>
                  <option value="rice">Rice</option>
                  <option value="corn">Corn</option>
                  <option value="tomato">Tomato</option>
                </select>
              </div>
              <div className="space-y-2 text-left">
                <label className="text-sm font-medium text-foreground">Quantity (kg)</label>
                <input 
                  type="number" 
                  value={formData.quantity}
                  onChange={e => setFormData({...formData, quantity: e.target.value})}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" 
                  placeholder="e.g. 500"
                  min="1"
                  required
                />
              </div>
              <div className="space-y-2 text-left">
                <label className="text-sm font-medium text-foreground">Origin location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input 
                    type="text" 
                    value={formData.origin}
                    onChange={e => setFormData({...formData, origin: e.target.value})}
                    className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" 
                    placeholder="Farm address or region"
                    required
                  />
                </div>
              </div>
              <Button type="submit" disabled={isCreating} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white mt-2">
                {isCreating ? 'Creating...' : 'Register Batch'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* My Batches List */}
        <div className="lg:col-span-2">
          <Card className="border border-border bg-card shadow-sm h-full">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-emerald-600" />
                  <CardTitle className="text-lg font-semibold text-foreground">My Batches</CardTitle>
                </div>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  {batches.length} Total
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {batches.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                  <Package className="h-12 w-12 mb-3 text-muted" />
                  <p>You haven't created any batches yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30 hover:bg-muted/30 border-b border-border/40">
                        <TableHead className="py-4 px-6 font-semibold text-foreground">Batch ID</TableHead>
                        <TableHead className="py-4 px-6 font-semibold text-foreground">Crop</TableHead>
                        <TableHead className="py-4 px-6 font-semibold text-foreground">Quantity</TableHead>
                        <TableHead className="py-4 px-6 font-semibold text-foreground">Stage</TableHead>
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
                              {batch.currentStage}
                            </Badge>
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
      </div>
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
