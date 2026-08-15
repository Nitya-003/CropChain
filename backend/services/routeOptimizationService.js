const axios = require('axios');

/**
 * RouteOptimizationService
 * Solves the Traveling Salesperson Problem (TSP) for daily logistics trucks 
 * handling multi-stop pickups and deliveries using the Mapbox/Google Maps Matrix API.
 */
class RouteOptimizationService {
  constructor() {
    // In a real application, this should be pulled from environment variables
    this.mapsApiKey = process.env.MAPBOX_API_KEY || 'mock-api-key';
    this.matrixApiUrl = 'https://api.mapbox.com/directions-matrix/v1/mapbox/driving';
  }

  /**
   * Fetches a distance matrix (travel times and distances) between all provided waypoints
   * @param {Array} waypoints - Array of { lng, lat } objects
   * @returns {Object} Matrix of travel times and distances
   */
  async _getDistanceMatrix(waypoints) {
    if (this.mapsApiKey === 'mock-api-key') {
      // Mock logic for local testing without an actual API key
      return this._generateMockMatrix(waypoints);
    }

    const coordinatesStr = waypoints.map(wp => `${wp.lng},${wp.lat}`).join(';');
    
    try {
      const response = await axios.get(`${this.matrixApiUrl}/${coordinatesStr}`, {
        params: {
          access_token: this.mapsApiKey,
          annotations: 'distance,duration'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Failed to fetch distance matrix:', error);
      throw new Error('Distance Matrix API failure');
    }
  }

  /**
   * Simple Nearest Neighbor algorithm to solve TSP for a single truck.
   * This provides a fast, reasonable approximation for short multi-stop routes.
   * @param {Array} waypoints - Original list of stops including the starting hub.
   * @param {Array} durations - 2D matrix of travel times.
   * @returns {Object} Optimized route order and total metrics.
   */
  _solveTSPNearestNeighbor(waypoints, durations) {
    const unvisited = new Set(waypoints.map((_, i) => i));
    
    let currentIdx = 0; // Assume waypoints[0] is the starting hub
    unvisited.delete(currentIdx);
    
    const optimizedPath = [waypoints[currentIdx]];
    let totalDuration = 0;

    while (unvisited.size > 0) {
      let nearestIdx = -1;
      let minDuration = Infinity;

      for (let nextIdx of unvisited) {
        const timeToNext = durations[currentIdx][nextIdx];
        if (timeToNext < minDuration) {
          minDuration = timeToNext;
          nearestIdx = nextIdx;
        }
      }

      optimizedPath.push(waypoints[nearestIdx]);
      totalDuration += minDuration;
      unvisited.delete(nearestIdx);
      currentIdx = nearestIdx;
    }

    // Return to origin (Optional: remove if the truck ends at the final stop)
    const returnTime = durations[currentIdx][0];
    optimizedPath.push(waypoints[0]);
    totalDuration += returnTime;

    return {
      optimizedWaypoints: optimizedPath,
      totalDurationSeconds: totalDuration
    };
  }

  /**
   * Optimizes the logistics route for a truck given a starting point and multiple stops.
   * @param {Object} truckProfile - details about the truck (id, driver)
   * @param {Object} startHub - { id, lat, lng }
   * @param {Array} stops - Array of farm/delivery stops { id, lat, lng, type }
   * @returns {Object} The complete optimized route payload for the Driver UI
   */
  async optimizeTruckRoute(truckProfile, startHub, stops) {
    if (!stops || stops.length === 0) {
      throw new Error("No stops provided for optimization.");
    }

    // Ensure startHub is the 0th index
    const allWaypoints = [startHub, ...stops];
    
    // 1. Fetch real-world distance matrix
    const matrix = await _getDistanceMatrix(allWaypoints);
    
    // 2. Solve TSP
    const { optimizedWaypoints, totalDurationSeconds } = this._solveTSPNearestNeighbor(allWaypoints, matrix.durations);

    // 3. Format payload for Driver Mobile UI (which maps these points visually)
    return {
      routeId: `ROUTE-${Date.now()}`,
      truckId: truckProfile.id,
      driverName: truckProfile.driver,
      totalStops: stops.length,
      estimatedTotalDurationMinutes: Math.round(totalDurationSeconds / 60),
      // Mobile app consumes this ordered array to fetch turn-by-turn nav
      waypointSequence: optimizedWaypoints,
      status: 'DISPATCHED'
    };
  }

  // --- Mock Helpers ---
  
  _generateMockMatrix(waypoints) {
    const size = waypoints.length;
    const durations = Array(size).fill(0).map(() => Array(size).fill(0));
    const distances = Array(size).fill(0).map(() => Array(size).fill(0));

    // Simple Euclidean distance proxy for mock data
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (i === j) continue;
        const dx = waypoints[i].lng - waypoints[j].lng;
        const dy = waypoints[i].lat - waypoints[j].lat;
        // Mock distance in km approximation
        const distKm = Math.sqrt(dx*dx + dy*dy) * 111; 
        distances[i][j] = distKm;
        // Mock duration (assuming 60 km/h avg)
        durations[i][j] = (distKm / 60) * 3600; 
      }
    }
    return { durations, distances };
  }
}

module.exports = new RouteOptimizationService();
