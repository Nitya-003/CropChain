const axios = require('axios');

/**
 * WeatherAnalyticsService
 * Integrates hyper-local weather APIs (e.g., OpenWeatherMap Agromonitoring)
 * to help farmers perfectly time their harvests and avoid critical weather events.
 */
class WeatherAnalyticsService {
  constructor() {
    this.apiKey = process.env.AGROMONITORING_API_KEY || 'mock-agro-api-key';
    this.baseUrl = 'http://api.agromonitoring.com/agro/1.0';
    
    // Internal cache to prevent spamming the external API
    this.weatherCache = new Map();
  }

  /**
   * Fetches granular hyper-local weather data for a specific farm's polygon ID.
   * @param {string} polyId - The Agromonitoring Polygon ID mapped to the farmer's GPS coordinates.
   * @returns {Object} Granular weather data intended for the Harvest Dashboard UI.
   */
  async getDashboardData(polyId) {
    if (!polyId) throw new Error("Farm Polygon ID is required.");

    // Simple caching mechanism (5 minutes)
    if (this.weatherCache.has(polyId)) {
      const cached = this.weatherCache.get(polyId);
      if (Date.now() - cached.timestamp < 300000) {
        return cached.data;
      }
    }

    try {
      // 1. Fetch current weather and soil data
      const [weather, soil] = await Promise.all([
        this._fetchCurrentWeather(polyId),
        this._fetchSoilData(polyId)
      ]);

      // 2. Format the payload for the frontend UI dashboard
      const dashboardPayload = {
        timestamp: new Date().toISOString(),
        polyId,
        ambient: {
          tempCelsius: weather.main.temp - 273.15, // Kelvin to Celsius
          humidityPct: weather.main.humidity,
          precipitationProb: weather.pop ? weather.pop * 100 : 0 // Probability of precipitation
        },
        soil: {
          tempCelsius: soil.t0 - 273.15, // Surface temp
          moisturePct: soil.moisture * 100 // Volumetric water content
        },
        alerts: this._generateWarnings(weather, soil)
      };

      this.weatherCache.set(polyId, { timestamp: Date.now(), data: dashboardPayload });
      return dashboardPayload;

    } catch (error) {
      console.error("[WeatherAnalyticsService] API Fetch failed:", error);
      // Return fallback mock data if external API fails (useful for UI development)
      return this._getMockDashboardData(polyId);
    }
  }

  /**
   * Cron job logic to poll weather for all active farms and push critical alerts.
   * @param {Array} activeFarms - Array of { farmerId, polyId, pushToken }
   */
  async monitorAndPushAlerts(activeFarms) {
    let alertsSent = 0;

    for (const farm of activeFarms) {
      const data = await this.getDashboardData(farm.polyId);
      
      if (data.alerts && data.alerts.length > 0) {
        // Trigger push notification service (e.g., Firebase FCM)
        await this._sendPushNotification(farm.pushToken, data.alerts);
        alertsSent++;
      }
    }

    return { status: 'SUCCESS', farmsChecked: activeFarms.length, alertsSent };
  }

  // --- Internal Helpers ---

  async _fetchCurrentWeather(polyId) {
    if (this.apiKey === 'mock-agro-api-key') throw new Error("Mock Key");
    const res = await axios.get(`${this.baseUrl}/weather?polyid=${polyId}&appid=${this.apiKey}`);
    return res.data;
  }

  async _fetchSoilData(polyId) {
    if (this.apiKey === 'mock-agro-api-key') throw new Error("Mock Key");
    const res = await axios.get(`${this.baseUrl}/soil?polyid=${polyId}&appid=${this.apiKey}`);
    return res.data;
  }

  _generateWarnings(weatherData, soilData) {
    const warnings = [];
    const tempC = weatherData.main.temp - 273.15;
    
    if (tempC < 0) {
      warnings.push({ type: 'FROST_WARNING', message: 'Critical frost approaching. Harvest immediately if vulnerable.' });
    }
    
    // If probability of precipitation is > 80% and it's a heavy storm
    if (weatherData.pop > 0.8 && weatherData.weather[0].main === 'Thunderstorm') {
      warnings.push({ type: 'STORM_ALERT', message: 'Heavy storm imminent. Secure loose equipment and delay planting.' });
    }
    
    return warnings;
  }

  async _sendPushNotification(pushToken, alerts) {
    // Integration point for FCM / APNS
    console.log(`[PUSH NOTIFICATION] Sending to ${pushToken}:`, alerts.map(a => a.message).join(' | '));
  }

  _getMockDashboardData(polyId) {
    return {
      timestamp: new Date().toISOString(),
      polyId,
      ambient: { tempCelsius: 22.5, humidityPct: 65, precipitationProb: 85 },
      soil: { tempCelsius: 18.0, moisturePct: 40 },
      alerts: [
         { type: 'STORM_ALERT', message: 'Heavy storm imminent. Secure loose equipment.' }
      ]
    };
  }
}

module.exports = new WeatherAnalyticsService();
