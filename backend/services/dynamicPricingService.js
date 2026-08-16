/**
 * DynamicPricingService
 * Analyzes crop shelf-life and real-time spoilage risks (via IoT telemetry) to dynamically
 * adjust B2B wholesale prices. This prevents food waste by clearing inventory nearing peak maturity.
 */
class DynamicPricingService {
  constructor() {
    // Base shelf-life estimates in hours at optimal temperature
    this.cropProfiles = {
      'TOMATOES': { baseShelfLifeHours: 336, optimalTempC: 12 },   // ~14 days
      'AVOCADOS': { baseShelfLifeHours: 168, optimalTempC: 5 },    // ~7 days
      'LETTUCE':  { baseShelfLifeHours: 240, optimalTempC: 1 },    // ~10 days
      'APPLES':   { baseShelfLifeHours: 720, optimalTempC: 2 }     // ~30 days
    };
  }

  /**
   * Calculates the remaining shelf-life and risk factor for a batch based on IoT telemetry.
   * @param {Object} batchData - Contains { cropType, harvestTime, basePrice }
   * @param {Array} telemetryHistory - Array of { timestamp, avgTempC } for the batch
   * @returns {Object} shelfLifeData containing risk score and remaining hours
   */
  _calculateSpoilageRisk(batchData, telemetryHistory) {
    const profile = this.cropProfiles[batchData.cropType.toUpperCase()];
    if (!profile) throw new Error("Unknown crop type profile.");

    const now = Date.now();
    const harvestTimeMs = new Date(batchData.harvestTime).getTime();
    const hoursSinceHarvest = (now - harvestTimeMs) / (1000 * 60 * 60);

    // 1. Calculate standard depletion
    let effectiveHoursDepleted = hoursSinceHarvest;

    // 2. Adjust for IoT Temperature variances (Penalty for non-optimal storage)
    if (telemetryHistory && telemetryHistory.length > 0) {
      let tempPenaltyMultiplier = 1.0;
      
      // Basic mock logic: Higher average temp relative to optimal = faster spoilage
      const avgTransitTemp = telemetryHistory.reduce((acc, curr) => acc + curr.avgTempC, 0) / telemetryHistory.length;
      
      if (avgTransitTemp > profile.optimalTempC) {
        // e.g., Every 1 degree C above optimal accelerates spoilage by 10%
        const degreesAbove = avgTransitTemp - profile.optimalTempC;
        tempPenaltyMultiplier = 1.0 + (degreesAbove * 0.10);
      }

      effectiveHoursDepleted = hoursSinceHarvest * tempPenaltyMultiplier;
    }

    const remainingHours = Math.max(0, profile.baseShelfLifeHours - effectiveHoursDepleted);
    const lifeRemainingPct = remainingHours / profile.baseShelfLifeHours;
    
    // Risk Score: 0 is fresh, 100 is completely spoiled
    const riskScore = Math.max(0, Math.min(100, (1 - lifeRemainingPct) * 100));

    return {
      remainingHours: Math.round(remainingHours),
      lifeRemainingPct,
      riskScore
    };
  }

  /**
   * Evaluates a crop batch and dynamically updates its price on the B2B marketplace API.
   * @param {Object} batchData - The crop batch payload.
   * @param {Array} telemetryHistory - IoT temperature logs.
   * @returns {Object} Pricing update payload intended for the Marketplace API.
   */
  evaluateAndUpdatePricing(batchData, telemetryHistory) {
    const riskAnalysis = this._calculateSpoilageRisk(batchData, telemetryHistory);
    
    let currentPrice = batchData.basePrice;
    let isFlashDeal = false;
    let discountReason = "";

    // Pricing Logic:
    // If >80% life remaining, full price.
    // If 40%-80%, apply slight discount to clear stock.
    // If <40% life remaining, activate Flash Deal to prevent complete waste.
    
    if (riskAnalysis.riskScore > 60) {
      // High spoilage risk / Nearing peak maturity
      currentPrice = batchData.basePrice * 0.50; // 50% discount
      isFlashDeal = true;
      discountReason = "PEAK_MATURITY_FLASH_SALE";
    } else if (riskAnalysis.riskScore > 20) {
      // Moderate risk
      currentPrice = batchData.basePrice * 0.85; // 15% discount
      discountReason = "STANDARD_DEPRECIATION";
    }

    const pricingUpdate = {
      batchId: batchData.batchId,
      originalPrice: batchData.basePrice,
      newListingPrice: Number(currentPrice.toFixed(2)),
      isFlashDeal,
      discountReason,
      riskScore: Math.round(riskAnalysis.riskScore),
      estimatedRemainingShelfLifeHours: riskAnalysis.remainingHours,
      timestamp: new Date().toISOString()
    };

    // In a production environment, this payload would be sent to the B2B Marketplace DB/API
    // await B2BMarketplaceAPI.updateListing(pricingUpdate);

    return pricingUpdate;
  }
}

module.exports = new DynamicPricingService();
