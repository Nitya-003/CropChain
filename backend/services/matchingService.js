const crypto = require('crypto');

/**
 * Dynamic Supply-Demand Matching Engine for Regional Markets
 * Evaluates distance, shelf-life, and regional demand to recommend the best hubs.
 */
class MatchingService {
  constructor() {
    // Mock regional hubs database
    this.regionalHubs = [
      { id: 'hub-1', name: 'North Region Distribution', lat: 34.05, lng: -118.24, currentDemandScore: 85, pricePremiumPct: 10 },
      { id: 'hub-2', name: 'Central Valley Storage', lat: 36.77, lng: -119.41, currentDemandScore: 40, pricePremiumPct: -5 },
      { id: 'hub-3', name: 'East Coast Transit Point', lat: 40.71, lng: -74.00, currentDemandScore: 95, pricePremiumPct: 25 },
      { id: 'hub-4', name: 'South West Market Hub', lat: 33.44, lng: -112.07, currentDemandScore: 60, pricePremiumPct: 5 }
    ];
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  _calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  /**
   * Matches a farmer's crop to the best 3 distribution hubs
   * @param {Object} cropData - { type, quantity, originLat, originLng, expectedShelfLifeDays, basePrice }
   * @returns {Array} Top 3 recommended hubs
   */
  findBestHubs(cropData) {
    const { originLat, originLng, expectedShelfLifeDays, basePrice } = cropData;

    let scoredHubs = this.regionalHubs.map(hub => {
      const distanceKm = this._calculateDistance(originLat, originLng, hub.lat, hub.lng);
      
      // Transit time estimation (assuming 50km/h avg speed by truck)
      const transitDays = distanceKm / (50 * 24); 
      
      // Risk factor if transit time takes up too much of shelf life
      let shelfLifeRisk = 0;
      if (transitDays > expectedShelfLifeDays * 0.7) {
        shelfLifeRisk = 50; // High risk of spoilage
      }

      // Calculate matching score: Higher demand + closer distance - shelf life risk
      // Weighting: Demand (50%), Distance (30%), Spoilage Risk (20%)
      const normalizedDistanceScore = Math.max(0, 100 - (distanceKm / 50)); 
      
      const totalScore = 
        (hub.currentDemandScore * 0.5) + 
        (normalizedDistanceScore * 0.3) - 
        (shelfLifeRisk * 0.2);

      // Expected final payout based on regional price premium
      const expectedPricing = basePrice * (1 + (hub.pricePremiumPct / 100));

      return {
        ...hub,
        distanceKm: Math.round(distanceKm),
        transitDays: transitDays.toFixed(2),
        matchScore: totalScore.toFixed(1),
        expectedPricing: expectedPricing.toFixed(2)
      };
    });

    // Sort by match score descending
    scoredHubs.sort((a, b) => b.matchScore - a.matchScore);

    return scoredHubs.slice(0, 3);
  }

  /**
   * Automatically generates a digital waybill for the selected route
   */
  generateDigitalWaybill(farmerId, selectedHubId, cropData) {
    const hub = this.regionalHubs.find(h => h.id === selectedHubId);
    if (!hub) throw new Error("Selected Hub not found");

    const waybill = {
      waybillId: `WB-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      farmerId,
      destinationHub: hub.name,
      cargo: cropData,
      status: 'PENDING_PICKUP',
      generatedAt: new Date().toISOString(),
      routingData: {
        distanceKm: Math.round(this._calculateDistance(cropData.originLat, cropData.originLng, hub.lat, hub.lng))
      }
    };

    // In a real app, save waybill to database/blockchain here
    return waybill;
  }
}

module.exports = new MatchingService();
