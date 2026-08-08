const { recordIoTDataSchema } = require("../validations/batchSchema");
const logger = require("../utils/logger");
const apiResponse = require("../utils/apiResponse");

exports.recordTelemetry = async (req, res) => {
  try {
    const { batch } = req;
    
    // Validate request body
    const validatedData = recordIoTDataSchema.parse(req.body);
    const { temperature, humidity } = validatedData;
    
    const timestamp = new Date();

    // Initialize iotData if it doesn't exist
    if (!batch.iotData) {
      batch.iotData = {
        telemetryHistory: []
      };
    }

    // Update current readings
    batch.iotData.currentTemperature = temperature;
    batch.iotData.currentHumidity = humidity;
    batch.iotData.lastUpdated = timestamp;
    
    // Push to history
    batch.iotData.telemetryHistory.push({
      temperature,
      humidity,
      timestamp
    });

    // Simple spoilage threshold fallback.
    // The background spoilageRiskAgent handles complex predictions, but this provides immediate extreme bounds checking.
    if (temperature > 40 || temperature < -10) {
      batch.iotData.isSpoiled = true;
    }

    await batch.save();

    logger.info("IoT telemetry recorded successfully", {
      batchId: batch.batchId,
      temperature,
      humidity,
      recordedBy: req.user.id || req.user._id
    });

    return res.status(200).json(apiResponse.successResponse(
      "IoT telemetry recorded successfully",
      {
        batchId: batch.batchId,
        currentTemperature: batch.iotData.currentTemperature,
        currentHumidity: batch.iotData.currentHumidity,
        isSpoiled: batch.iotData.isSpoiled,
        lastUpdated: batch.iotData.lastUpdated
      }
    ));
  } catch (error) {
    if (error.name === "ZodError") {
      return res.status(400).json(
        apiResponse.validationErrorResponse("Validation Error", error.errors)
      );
    }
    
    logger.error("Failed to record IoT telemetry", {
      error: error.message,
      stack: error.stack,
      batchId: req.batch?.batchId
    });
    
    return res.status(500).json(
      apiResponse.errorResponse("Failed to record IoT telemetry")
    );
  }
};
