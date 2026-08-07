const carbonService = require("../services/carbonService");
const logger = require("../utils/logger");

jest.mock("../utils/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

describe("CarbonService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("calculateMockDistance", () => {
    test("returns a consistent distance for same origin and destination", () => {
      const distance1 = carbonService.calculateMockDistance("Delhi", "Mumbai");
      const distance2 = carbonService.calculateMockDistance("Delhi", "Mumbai");
      expect(distance1).toBe(distance2);
    });

    test("handles case insensitivity and trims whitespace", () => {
      const distance1 = carbonService.calculateMockDistance("Delhi", "Mumbai");
      const distance2 = carbonService.calculateMockDistance(" DELHI ", " mumbai ");
      expect(distance1).toBe(distance2);
    });

    test("returns 0 if origin or destination is missing", () => {
      expect(carbonService.calculateMockDistance("", "Mumbai")).toBe(0);
      expect(carbonService.calculateMockDistance("Delhi", "")).toBe(0);
      expect(carbonService.calculateMockDistance(null, null)).toBe(0);
    });
  });

  describe("calculateEmissions", () => {
    test("calculates emissions correctly based on distance and weight", () => {
      // Mock distance for deterministic testing
      const mockDistanceSpy = jest
        .spyOn(carbonService, "calculateMockDistance")
        .mockReturnValue(500); // 500 km

      // 2000 kg = 2 tons
      // 2 tons * 500 km * 0.105 = 105 kg CO2
      const result = carbonService.calculateEmissions("Farm A", "Warehouse B", 2000);
      
      expect(result).toEqual({
        distanceKm: 500,
        emissionsKgCO2: 105
      });

      mockDistanceSpy.mockRestore();
    });

    test("returns 0 emissions if origin and destination are the same", () => {
      const result = carbonService.calculateEmissions("Delhi", "Delhi", 1000);
      expect(result).toEqual({
        distanceKm: 0,
        emissionsKgCO2: 0
      });
    });

    test("returns 0 emissions if weight is 0 or missing", () => {
      const result = carbonService.calculateEmissions("Delhi", "Mumbai", 0);
      expect(result).toEqual({
        distanceKm: 0,
        emissionsKgCO2: 0
      });
    });

    test("handles calculation errors gracefully", () => {
      const mockDistanceSpy = jest
        .spyOn(carbonService, "calculateMockDistance")
        .mockImplementation(() => {
          throw new Error("Calculation failed");
        });

      const result = carbonService.calculateEmissions("A", "B", 1000);
      
      expect(result).toEqual({
        distanceKm: 0,
        emissionsKgCO2: 0
      });
      expect(logger.error).toHaveBeenCalledWith("Error calculating carbon emissions", { error: "Calculation failed" });

      mockDistanceSpy.mockRestore();
    });
  });
});
