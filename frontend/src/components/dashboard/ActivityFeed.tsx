import React, { useEffect, useState, useTransition } from 'react';
import { activityFeedService, ActivityItem, ActivityFilters } from '../../services/activityFeedService';
import { useAuth } from '../../context/AuthContext';
import { 
  Sprout, 
  MapPin, 
  Calendar, 
  User as UserIcon, 
  Shield, 
  AlertTriangle, 
  Truck, 
  Store, 
  RefreshCw, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

// Custom Relative Time formatting
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMins = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMins < 1) return 'Just now';
  if (diffInMins < 60) return `${diffInMins}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${diffInDays}d ago`;
};

// Map eventType to corresponding icon and tailwind color styles
const getEventStyles = (eventType: string) => {
  switch (eventType) {
    case 'crop_registered':
      return { icon: Sprout, colorClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' };
    case 'harvest_completed':
      return { icon: Sprout, colorClass: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30' };
    case 'ownership_transferred':
      return { icon: UserIcon, colorClass: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' };
    case 'shipment_created':
      return { icon: Truck, colorClass: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30' };
    case 'shipment_status_updated':
      return { icon: Truck, colorClass: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' };
    case 'delivery_confirmed':
      return { icon: Store, colorClass: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30' };
    case 'batch_verified':
      return { icon: Shield, colorClass: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30' };
    case 'batch_recalled':
      return { icon: AlertTriangle, colorClass: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30' };
    case 'iot_data_recorded':
      return { icon: Cpu, colorClass: 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/30' };
    default:
      return { icon: Shield, colorClass: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/30' };
  }
};

const ActivityFeed: React.FC = () => {
  const { user } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Filters State
  const [eventType, setEventType] = useState<string>('');
  const [batchIdInput, setBatchIdInput] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);

  const fetchFeed = async (filters: ActivityFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const response = await activityFeedService.getFeed(filters);
      if (response.success) {
        setActivities(response.data.activities);
        setTotalPages(response.data.pagination.totalPages);
      } else {
        setError(response.message || 'Failed to fetch activity feed');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Network error fetching feed');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setPage(1);
    fetchFeed({
      eventType: eventType || undefined,
      batchId: batchIdInput.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1,
      limit: 10
    });
  };

  useEffect(() => {
    fetchFeed({
      eventType: eventType || undefined,
      batchId: batchIdInput.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      limit: 10
    });
  }, [page, eventType, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPage(1);
    fetchFeed({
      eventType: eventType || undefined,
      batchId: batchIdInput.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1,
      limit: 10
    });
  };

  return (
    <Card className="w-full shadow-md border-border/60">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
        <div>
          <CardTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Activity Feed
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Personalized activity feed for role: <span className="font-semibold text-primary uppercase">{user?.role}</span></p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh} 
          disabled={loading}
          aria-label="Refresh activity feed"
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>
      
      {/* Filtering UI */}
      <div className="p-4 bg-muted/20 border-b flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="search-batch-id" className="block text-xs font-semibold text-muted-foreground mb-1">Batch ID Search</label>
          <form onSubmit={handleSearchSubmit} className="relative">
            <input
              id="search-batch-id"
              type="text"
              placeholder="e.g. CROP-2026-0001"
              value={batchIdInput}
              onChange={(e) => setBatchIdInput(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          </form>
        </div>

        <div className="min-w-[150px]">
          <label htmlFor="filter-event-type" className="block text-xs font-semibold text-muted-foreground mb-1">Event Type</label>
          <select
            id="filter-event-type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Events</option>
            <option value="crop_registered">Crop Registered</option>
            <option value="harvest_completed">Harvest Completed</option>
            <option value="ownership_transferred">Ownership Transfer</option>
            <option value="shipment_created">Shipment Created</option>
            <option value="shipment_status_updated">Shipment Status Update</option>
            <option value="delivery_confirmed">Delivery Confirmed</option>
            <option value="batch_verified">Verification Action</option>
            <option value="batch_recalled">Batch Recalled</option>
            <option value="iot_data_recorded">IoT Telemetry</option>
          </select>
        </div>

        <div>
          <label htmlFor="filter-start-date" className="block text-xs font-semibold text-muted-foreground mb-1">From Date</label>
          <input
            id="filter-start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div>
          <label htmlFor="filter-end-date" className="block text-xs font-semibold text-muted-foreground mb-1">To Date</label>
          <input
            id="filter-end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground" aria-busy="true">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">Loading activity feed...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center" role="alert">
            <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-red-500">{error}</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={handleRefresh}>Try Again</Button>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Sprout className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-base font-semibold">No activities found</p>
            <p className="text-xs">Adjust your search filters or check back later for updates.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {activities.map((item, index) => {
              const { icon: EventIcon, colorClass } = getEventStyles(item.eventType);
              return (
                <div key={item._id} className="p-4 flex gap-4 items-start hover:bg-muted/10 transition-colors">
                  <div className={`p-2.5 rounded-xl shrink-0 ${colorClass}`}>
                    <EventIcon className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 space-y-1 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{item.description}</p>
                      <span className="text-[11px] text-muted-foreground shrink-0 font-medium">{formatRelativeTime(item.timestamp)}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                      {item.batchId && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10">Batch: {item.batchId}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1">
                        <UserIcon className="h-3.5 w-3.5" />
                        <span>Role: <span className="capitalize">{item.userRole}</span></span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && !loading && (
          <div className="p-4 border-t flex items-center justify-between bg-muted/5">
            <span className="text-xs text-muted-foreground font-medium">Page {page} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.max(p - 1, 1))} 
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage(p => Math.min(p + 1, totalPages))} 
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActivityFeed;
