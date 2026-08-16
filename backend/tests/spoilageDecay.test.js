const { calculateMultiModalShelfLife } = require("../services/spoilageDetectionService");

describe("Multi-Modal Produce Shelf-Life & Spoilage Decay Test Suite", () => {
  it("should calculate remaining shelf-life days and low decay index for ideal cold-chain conditions", () => {
    const result = calculateMultiModalShelfLife({
      cropType: "Tomato",
      temperatureC: 6.0,
      humidity: 85.0,
      daysInTransit: 1.0,
      spotRatio: 0.01,
    });

    expect(result.cropType).toBe("tomato");
    expect(result.remainingDays).toBeGreaterThan(10);
    expect(result.decayIndexPct).toBeLessThan(30);
    expect(result.isSpoilageRiskHigh).toBe(false);
  });

  it("should calculate elevated decay index and high spoilage risk under high heat and necrosis", () => {
    const result = calculateMultiModalShelfLife({
      cropType: "Tomato",
      temperatureC: 38.0,
      humidity: 45.0,
      daysInTransit: 3.0,
      spotRatio: 0.25,
    });

    expect(result.decayIndexPct).toBeGreaterThan(50);
    expect(result.isSpoilageRiskHigh).toBe(true);
    expect(result.suggestedAction).toContain("Immediate express distribution");
  });
});
