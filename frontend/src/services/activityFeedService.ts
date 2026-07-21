import { apiClient } from "./apiClient";

export interface ActivityItem {
  _id: string;
  eventType: string;
  timestamp: string;
  userId: string;
  userRole: string;
  batchId?: string;
  description: string;
  metadata: any;
}

export interface ActivityFeedResponse {
  success: boolean;
  data: {
    activities: ActivityItem[];
    pagination: {
      totalItems: number;
      currentPage: number;
      totalPages: number;
      limit: number;
    };
  };
  message: string;
}

export interface ActivityFilters {
  eventType?: string;
  batchId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const activityFeedService = {
  /**
   * Fetch personalized activity feed for current user
   */
  getFeed: async (
    filters: ActivityFilters = {},
  ): Promise<ActivityFeedResponse> => {
    const params = new URLSearchParams();
    if (filters.eventType) params.append("eventType", filters.eventType);
    if (filters.batchId) params.append("batchId", filters.batchId);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.page) params.append("page", String(filters.page));
    if (filters.limit) params.append("limit", String(filters.limit));

    const response = await apiClient.get<ActivityFeedResponse>(
      `/activities/feed?${params.toString()}`,
    );
    return response.data;
  },

  /**
   * Fetch all activities (Admin only)
   */
  getAllActivities: async (
    filters: ActivityFilters = {},
  ): Promise<ActivityFeedResponse> => {
    const params = new URLSearchParams();
    if (filters.eventType) params.append("eventType", filters.eventType);
    if (filters.batchId) params.append("batchId", filters.batchId);
    if (filters.startDate) params.append("startDate", filters.startDate);
    if (filters.endDate) params.append("endDate", filters.endDate);
    if (filters.page) params.append("page", String(filters.page));
    if (filters.limit) params.append("limit", String(filters.limit));

    const response = await apiClient.get<ActivityFeedResponse>(
      `/activities?${params.toString()}`,
    );
    return response.data;
  },
};
