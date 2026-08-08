const logger = require("../utils/logger");

class CarbonService {
  /**
   * Deterministic mock distance calculator.
   * Generates a consistent distance in km based on the string hash of origin + destination.
   * In a real production environment, this would call Google Maps Distance Matrix API.
   * @param {string} origin 
   * @param {string} destination 
   * @returns {number} Distance in km
   */
  calculateMockDistance(origin, destination) {
    if (!origin || !destination) return 0;
    
    // Simple hash function for consistent distances
    const str = `${origin.toLowerCase().trim()}-${destination.toLowerCase().trim()}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    
    // Map hash to a distance between 50 and 800 km
    const absHash = Math.abs(hash);
    const distance = 50 + (absHash % 750);
    return distance;
  }

  /**
   * Calculate emissions for a transport leg
   * @param {string} origin 
   * @param {string} destination 
   * @param {number} weightKg 
   * @returns {Object} Emission details { distanceKm, emissionsKgCO2 }
   */
  calculateEmissions(origin, destination, weightKg) {
    try {
      if (!origin || !destination || !weightKg || origin.toLowerCase().trim() === destination.toLowerCase().trim()) {
        return { distanceKm: 0, emissionsKgCO2: 0 };
      }

      const distanceKm = this.calculateMockDistance(origin, destination);
      
      // Standard road freight emission factor: ~0.105 kg CO2 per ton-km
      const tons = weightKg / 1000;
      const EMISSION_FACTOR_PER_TON_KM = 0.105;
      
      const emissionsKgCO2 = Number((tons * distanceKm * EMISSION_FACTOR_PER_TON_KM).toFixed(2));
      
      return {
        distanceKm,
        emissionsKgCO2
      };
    } catch (error) {
      logger.error("Error calculating carbon emissions", { error: error.message });
      return { distanceKm: 0, emissionsKgCO2: 0 };
    }
  }
}

module.exports = new CarbonService();
