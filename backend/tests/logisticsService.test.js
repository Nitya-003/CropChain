"use strict";

const {
  haversineDistance,
  solveTSP,
  optimizeRoute,
} = require("../services/logisticsService");
const axios = require("axios");

jest.mock("axios");
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("Logistics Route Optimization Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("haversineDistance", () => {
    it("should calculate distance between two coordinates correctly", () => {
      // Coordinates for Bangalore and Mysore (~140 km)
      const blr = { lat: 12.971598, lng: 77.594562 };
      const mys = { lat: 12.29581, lng: 76.639381 };

      const dist = haversineDistance(blr, mys);
      // Distance should be approximately 128km
      expect(dist).toBeGreaterThan(120000);
      expect(dist).toBeLessThan(140000);
    });

    it("should return 0 for identical coordinates", () => {
      const p = { lat: 12.971598, lng: 77.594562 };
      expect(haversineDistance(p, p)).toBe(0);
    });
  });

  describe("solveTSP", () => {
    it("should solve a simple TSP without dependencies", () => {
      // 3 nodes. Node 0 is start.
      // Matrix:
      // 0 -> 1 = 10, 0 -> 2 = 5
      // 1 -> 0 = 10, 1 -> 2 = 20
      // 2 -> 0 = 5,  2 -> 1 = 8
      const matrix = [
        [0, 10, 5],
        [10, 0, 20],
        [5, 20, 0],
      ];

      const coordinates = [
        { lat: 0, lng: 0, type: "start" },
        { lat: 1, lng: 1, type: "pickup" },
        { lat: 2, lng: 2, type: "pickup" },
      ];

      const result = solveTSP(matrix, coordinates);
      // Shortest path starting from 0 is 0 -> 2 -> 1 (cost: 5 + 20 = 25 or 5 + 8 depending on symmetric/asymmetric.
      // Wait, 0 -> 2 is 5, then from 2 -> 1 is 8. Total is 13.
      // 0 -> 1 is 10, 1 -> 2 is 20. Total is 30.
      // So path should be [0, 2, 1]
      expect(result.path).toEqual([0, 2, 1]);
    });

    it("should enforce pickup before dropoff constraint", () => {
      // 4 nodes:
      // Node 0: start
      // Node 1: dropoff (batch A)
      // Node 2: pickup (batch A)
      // Node 3: pickup (batch B)
      // If we ignore constraint: 0 -> 1 -> 2 -> 3 might be shorter.
      // But we must visit 2 (pickup A) before 1 (dropoff A).

      const matrix = [
        [0, 5, 100, 10], // 0 is close to 1, far from 2
        [5, 0, 10, 100],
        [100, 10, 0, 5],
        [10, 100, 5, 0],
      ];

      const coordinates = [
        { lat: 0, lng: 0, type: "start" },
        { lat: 1, lng: 1, type: "dropoff", batchId: "batchA" },
        { lat: 2, lng: 2, type: "pickup", batchId: "batchA" },
        { lat: 3, lng: 3, type: "pickup", batchId: "batchB" },
      ];

      const result = solveTSP(matrix, coordinates);

      // Node 1 (dropoff) index is 1. Node 2 (pickup) index is 2.
      // In the resulting path, index of 2 MUST be less than index of 1.
      const indexOfPickup = result.path.indexOf(2);
      const indexOfDropoff = result.path.indexOf(1);

      expect(indexOfPickup).toBeLessThan(indexOfDropoff);
      expect(result.path[0]).toBe(0); // starts at 0
    });
  });

  describe("optimizeRoute", () => {
    it("should call OSRM APIs and return optimized route", async () => {
      const mockTableResponse = {
        data: {
          code: "Ok",
          durations: [
            [0, 10, 20],
            [10, 0, 30],
            [20, 30, 0],
          ],
          distances: [
            [0, 100, 200],
            [100, 0, 300],
            [200, 300, 0],
          ],
        },
      };

      const mockRouteResponse = {
        data: {
          code: "Ok",
          routes: [
            {
              distance: 300,
              duration: 30,
              geometry: {
                coordinates: [
                  [77.59, 12.97],
                  [77.6, 12.98],
                  [77.61, 12.99],
                ],
              },
            },
          ],
        },
      };

      axios.get.mockImplementation((url) => {
        if (url.includes("/table/")) {
          return Promise.resolve(mockTableResponse);
        } else if (url.includes("/route/")) {
          return Promise.resolve(mockRouteResponse);
        }
        return Promise.reject(new Error("Unknown URL"));
      });

      const coordinates = [
        { lat: 12.97, lng: 77.59, type: "start" },
        { lat: 12.98, lng: 77.6, type: "pickup" },
        { lat: 12.99, lng: 77.61, type: "dropoff" },
      ];

      const result = await optimizeRoute(coordinates);

      expect(result.orderedCoordinates).toHaveLength(3);
      expect(result.totalDistance).toBe(300);
      expect(result.totalDuration).toBe(30);
      expect(result.geometry).toEqual([
        [12.97, 77.59],
        [12.98, 77.6],
        [12.99, 77.61],
      ]);
      expect(result.isFallback).toBe(false);
    });

    it("should fall back to local calculations if OSRM fails", async () => {
      axios.get.mockRejectedValue(new Error("OSRM Server Offline"));

      const coordinates = [
        { lat: 12.97, lng: 77.59, type: "start" },
        { lat: 12.98, lng: 77.6, type: "pickup" },
      ];

      const result = await optimizeRoute(coordinates);

      expect(result.orderedCoordinates).toHaveLength(2);
      expect(result.totalDistance).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.geometry).toHaveLength(2); // Straight line coordinates
      expect(result.isFallback).toBe(true);
    });
  });
});
