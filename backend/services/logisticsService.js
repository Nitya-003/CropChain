'use strict';

const axios = require('axios');
const logger = require('../utils/logger');

// Haversine formula to compute great-circle distance between two coordinates in meters
function haversineDistance(coord1, coord2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (coord1.lat * Math.PI) / 180;
  const phi2 = (coord2.lat * Math.PI) / 180;
  const deltaPhi = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const deltaLambda = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // meters
}

// Build a distance/duration matrix locally using Haversine
// Speed is assumed to be 50 km/h (13.89 m/s) on average for rural/semi-urban areas
function buildLocalMatrix(coordinates) {
  const n = coordinates.length;
  const averageSpeed = 13.89; // meters per second
  const durations = Array.from({ length: n }, () => new Array(n).fill(0));
  const distances = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        durations[i][j] = 0;
        distances[i][j] = 0;
      } else {
        const dist = haversineDistance(coordinates[i], coordinates[j]);
        distances[i][j] = dist;
        durations[i][j] = dist / averageSpeed;
      }
    }
  }

  return { durations, distances };
}

// Solve the Pickup and Delivery Problem (PDP) / Traveling Salesman Problem (TSP)
// Returns the optimal path (array of indices starting with 0) and cost
function solveTSP(matrix, coordinates) {
  const n = coordinates.length;
  if (n <= 1) return { path: [0], cost: 0 };

  // Detect pickup-dropoff dependencies (pickup must occur before dropoff for the same batchId)
  const dependencies = {};
  for (let i = 1; i < n; i++) {
    const node = coordinates[i];
    if (node.type === 'dropoff' && node.batchId) {
      const pickupIndex = coordinates.findIndex(
        (c) => c.batchId === node.batchId && c.type === 'pickup'
      );
      if (pickupIndex !== -1 && pickupIndex !== i) {
        dependencies[i] = pickupIndex;
      }
    }
  }

  // Exact Backtracking DFS for small N (N <= 10)
  if (n <= 10) {
    let bestPath = null;
    let bestCost = Infinity;
    const path = [0];
    const visited = new Array(n).fill(false);
    visited[0] = true;

    function backtrack(currentIdx, currentCost) {
      if (currentCost >= bestCost) return; // Pruning

      if (path.length === n) {
        bestCost = currentCost;
        bestPath = [...path];
        return;
      }

      for (let next = 1; next < n; next++) {
        if (!visited[next]) {
          // Precedence check: dependency must be visited first
          const depIdx = dependencies[next];
          if (depIdx !== undefined && !visited[depIdx]) {
            continue; // Skip because pickup has not been visited yet
          }

          visited[next] = true;
          path.push(next);

          backtrack(next, currentCost + matrix[currentIdx][next]);

          path.pop();
          visited[next] = false;
        }
      }
    }

    backtrack(0, 0);

    // If a valid path is found, return it
    if (bestPath) {
      return { path: bestPath, cost: bestCost };
    }
  }

  // Fallback / Heuristic solver for larger N or if DFS fails
  // Greedy nearest-neighbor that respects precedence constraints
  const path = [0];
  const visited = new Array(n).fill(false);
  visited[0] = true;
  let currentIdx = 0;
  let totalCost = 0;

  while (path.length < n) {
    let nextIdx = -1;
    let minStepCost = Infinity;

    for (let next = 1; next < n; next++) {
      if (!visited[next]) {
        // Precedence check
        const depIdx = dependencies[next];
        if (depIdx !== undefined && !visited[depIdx]) {
          continue; // pickup not visited yet
        }

        const stepCost = matrix[currentIdx][next];
        if (stepCost < minStepCost) {
          minStepCost = stepCost;
          nextIdx = next;
        }
      }
    }

    if (nextIdx === -1) {
      // If we stuck due to dependency cycle, break and add remaining nodes arbitrarily
      for (let next = 1; next < n; next++) {
        if (!visited[next]) {
          nextIdx = next;
          minStepCost = matrix[currentIdx][next];
          break;
        }
      }
    }

    if (nextIdx !== -1) {
      visited[nextIdx] = true;
      path.push(nextIdx);
      totalCost += minStepCost;
      currentIdx = nextIdx;
    } else {
      break;
    }
  }

  return { path, cost: totalCost };
}

/**
 * Optimizes the route sequence for a given array of coordinates
 * @param {Array} coordinates - Array of coordinates [{lat, lng, address, type, batchId}]
 * @returns {Promise<Object>} Optimized route with ordered waypoints, total time, distance, and polyline geometry
 */
async function optimizeRoute(coordinates) {
  if (!coordinates || coordinates.length < 2) {
    throw new Error('At least two coordinates are required');
  }

  const n = coordinates.length;
  let durationsMatrix = null;
  let distancesMatrix = null;
  let isFallback = false;

  // Format coordinates for OSRM: lng,lat separated by semicolon
  const coordString = coordinates.map((c) => `${c.lng},${c.lat}`).join(';');
  const osrmUrl = `http://router.project-osrm.org/table/v1/driving/${coordString}`;

  try {
    logger.info('Requesting duration table from OSRM', { url: osrmUrl });
    const response = await axios.get(osrmUrl, {
      params: {
        annotations: 'duration,distance'
      },
      timeout: 5000 // 5 seconds timeout
    });

    if (response.data && response.data.code === 'Ok') {
      durationsMatrix = response.data.durations;
      distancesMatrix = response.data.distances;
    } else {
      throw new Error(`OSRM Table API returned code: ${response.data ? response.data.code : 'unknown'}`);
    }
  } catch (error) {
    logger.warn('OSRM Table API failed, falling back to Haversine calculation', { error: error.message });
    const local = buildLocalMatrix(coordinates);
    durationsMatrix = local.durations;
    distancesMatrix = local.distances;
    isFallback = true;
  }

  // Solve the route optimization problem
  const { path: optimalOrder, cost } = solveTSP(durationsMatrix, coordinates);

  // Map indices back to the original coordinates to get the ordered array
  const orderedCoordinates = optimalOrder.map((idx) => coordinates[idx]);

  // Now, calculate the precise route geometry and details using OSRM Route API or local fallback
  let totalDistance = 0;
  let totalDuration = 0;
  let geometry = []; // Array of [lat, lng] coordinates

  if (!isFallback) {
    const orderedCoordString = orderedCoordinates.map((c) => `${c.lng},${c.lat}`).join(';');
    const routeUrl = `http://router.project-osrm.org/route/v1/driving/${orderedCoordString}`;

    try {
      logger.info('Requesting route geometry from OSRM', { url: routeUrl });
      const response = await axios.get(routeUrl, {
        params: {
          overview: 'full',
          geometries: 'geojson'
        },
        timeout: 5000
      });

      if (response.data && response.data.code === 'Ok' && response.data.routes && response.data.routes.length > 0) {
        const route = response.data.routes[0];
        totalDistance = route.distance; // in meters
        totalDuration = route.duration; // in seconds
        
        // OSRM GeoJSON format returns coordinates as [lng, lat].
        // We map them to [lat, lng] for Leaflet mapping compatibility.
        if (route.geometry && route.geometry.coordinates) {
          geometry = route.geometry.coordinates.map((coord) => [coord[1], coord[0]]);
        }
      } else {
        throw new Error('OSRM Route API invalid response structure');
      }
    } catch (error) {
      logger.warn('OSRM Route API failed, using straight-line calculations', { error: error.message });
      isFallback = true;
    }
  }

  // If fallback is true or OSRM route API request failed, calculate total metrics locally and draw straight lines
  if (isFallback) {
    totalDistance = 0;
    totalDuration = 0;
    geometry = [];

    for (let i = 0; i < orderedCoordinates.length; i++) {
      const current = orderedCoordinates[i];
      geometry.push([current.lat, current.lng]);
      if (i > 0) {
        const prev = orderedCoordinates[i - 1];
        const prevIdx = optimalOrder[i - 1];
        const currentIdx = optimalOrder[i];
        totalDistance += distancesMatrix[prevIdx][currentIdx];
        totalDuration += durationsMatrix[prevIdx][currentIdx];
      }
    }
  }

  return {
    orderedCoordinates,
    optimalOrder,
    totalDistance, // meters
    totalDuration, // seconds
    geometry,      // [[lat, lng], ...]
    isFallback
  };
}

module.exports = {
  optimizeRoute,
  haversineDistance,
  solveTSP
};
