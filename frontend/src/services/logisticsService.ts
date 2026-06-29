import { apiClient } from './apiClient';

export interface Waypoint {
  lat: number;
  lng: number;
  address?: string;
  type?: 'start' | 'pickup' | 'dropoff';
  batchId?: string;
}

export interface OptimizeRouteResponse {
  orderedCoordinates: Waypoint[];
  optimalOrder: number[];
  totalDistance: number; // in meters
  totalDuration: number; // in seconds
  geometry: [number, number][]; // [[lat, lng], ...]
  isFallback: boolean;
}

export const logisticsService = {
  optimizeRoute: async (coordinates: Waypoint[]): Promise<OptimizeRouteResponse> => {
    const response = await apiClient.post('/logistics/optimize-route', { coordinates });
    return response.data.data;
  }
};
