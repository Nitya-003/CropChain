/**
 * PredictiveMaintenanceService
 * Ingests time-series telematics data from cold chain logistics vehicles
 * and flags anomalies indicating refrigeration wear and tear to prevent failures.
 */
class PredictiveMaintenanceService {
  constructor() {
    // Baseline thresholds for normal operation (can be calibrated per vehicle model)
    this.thresholds = {
      maxCompressorCycleDurationMs: 1200000, // 20 minutes maximum continuous run
      maxPowerDrawKw: 5.5,                   // Maximum expected power spike
      optimalTempVarianceDegC: 2.0           // Normal variance around setpoint
    };
  }

  /**
   * Evaluates a batch of time-series telemetry data for a vehicle to detect anomalies.
   * @param {string} vehicleId - The ID of the cold-chain truck.
   * @param {Array} telemetryBatch - Array of { timestamp, compressorActive, powerDraw, currentTemp, targetTemp }
   * @returns {Object} Anomaly report detailing risks and maintenance needs.
   */
  analyzeTelemetry(vehicleId, telemetryBatch) {
    if (!telemetryBatch || telemetryBatch.length === 0) {
      throw new Error("No telemetry data provided.");
    }

    let continuousCycleTime = 0;
    let anomalyCount = 0;
    let maxPowerSpike = 0;
    let extremeTempVariances = 0;
    let issues = [];

    for (let i = 0; i < telemetryBatch.length; i++) {
      const data = telemetryBatch[i];
      
      // Calculate temperature variance
      const variance = Math.abs(data.currentTemp - data.targetTemp);
      if (variance > this.thresholds.optimalTempVarianceDegC) {
        extremeTempVariances++;
      }

      // Track peak power draw
      if (data.powerDraw > maxPowerSpike) {
        maxPowerSpike = data.powerDraw;
      }
      if (data.powerDraw > this.thresholds.maxPowerDrawKw) {
        anomalyCount++;
        issues.push(`Power spike detected: ${data.powerDraw} kW at ${data.timestamp}`);
      }

      // Track continuous compressor cycles (assuming sequential minute-by-minute data)
      if (data.compressorActive) {
        continuousCycleTime += 60000; // Increment by 1 minute (mock interval)
        if (continuousCycleTime > this.thresholds.maxCompressorCycleDurationMs) {
          anomalyCount++;
          issues.push(`Compressor running continuously > 20 mins at ${data.timestamp}`);
          // Reset to avoid duplicate spam in this simple logic
          continuousCycleTime = 0; 
        }
      } else {
        continuousCycleTime = 0;
      }
    }

    // Determine overall risk level
    let riskLevel = 'LOW';
    if (anomalyCount > 5 || extremeTempVariances > 10) {
      riskLevel = 'HIGH';
    } else if (anomalyCount > 0 || extremeTempVariances > 3) {
      riskLevel = 'MEDIUM';
    }

    return {
      vehicleId,
      analyzedRecords: telemetryBatch.length,
      riskLevel,
      anomalyCount,
      maxPowerSpikeKw: maxPowerSpike,
      issuesDetected: issues,
      requiresMaintenance: riskLevel === 'HIGH' || riskLevel === 'MEDIUM',
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Processes incoming real-time IoT data stream and triggers maintenance scheduling if necessary.
   * @param {string} vehicleId - The ID of the cold-chain truck.
   * @param {Array} telemetryBatch - The raw telemetry data batch.
   */
  async processIoTStream(vehicleId, telemetryBatch) {
    const analysis = this.analyzeTelemetry(vehicleId, telemetryBatch);

    if (analysis.requiresMaintenance) {
      // In a real system, this would insert a record into the DB and trigger a Webhook/WebSocket event
      console.log(`[ALERT] Vehicle ${vehicleId} flagged for maintenance. Risk Level: ${analysis.riskLevel}`);
      
      // Automated maintenance scheduling logic
      const scheduledTicket = this._createMaintenanceTicket(vehicleId, analysis);
      
      return {
        success: true,
        alertTriggered: true,
        analysis,
        ticket: scheduledTicket
      };
    }

    return {
      success: true,
      alertTriggered: false,
      analysis
    };
  }

  /**
   * Internal helper to create a database record for the Fleet Manager UI
   */
  _createMaintenanceTicket(vehicleId, analysis) {
    return {
      ticketId: `MAINT-${Date.now()}`,
      vehicleId,
      priority: analysis.riskLevel === 'HIGH' ? 'URGENT' : 'STANDARD',
      description: `Automated alert: ${analysis.anomalyCount} anomalies detected. Primary issue: ${analysis.issuesDetected[0] || 'High temp variance'}`,
      status: 'SCHEDULED',
      createdAt: new Date().toISOString()
    };
  }
}

module.exports = new PredictiveMaintenanceService();
