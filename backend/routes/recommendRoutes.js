"use strict";

const express = require("express");
const router = express.Router();
const {
  getCropRecommendation,
} = require("../services/cropRecommendationService");
const {
  cropRecommendationSchema,
} = require("../validations/cropRecommendationSchema");
const validateRequest = require("../middleware/validator");
const apiResponse = require("../utils/apiResponse");

/**
 * @swagger
 * /api/recommend:
 *   post:
 *     summary: Get crop recommendation based on soil and climate parameters
 *     tags: [Recommendations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - N
 *               - P
 *               - K
 *               - pH
 *               - temperature
 *               - humidity
 *               - rainfall
 *             properties:
 *               N:
 *                 type: number
 *                 description: Nitrogen content (0-140)
 *               P:
 *                 type: number
 *                 description: Phosphorus content (5-145)
 *               K:
 *                 type: number
 *                 description: Potassium content (5-205)
 *               pH:
 *                 type: number
 *                 description: pH value of soil (3.5-9.5)
 *               temperature:
 *                 type: number
 *                 description: Temperature in Celsius (0-50)
 *               humidity:
 *                 type: number
 *                 description: Humidity percentage (10-100)
 *               rainfall:
 *                 type: number
 *                 description: Rainfall in mm (0-300)
 *     responses:
 *       200:
 *         description: Recommendation successfully generated
 *       400:
 *         description: Validation failed
 *       500:
 *         description: Recommendation service error
 */
router.post(
  "/",
  validateRequest(cropRecommendationSchema),
  async (req, res, next) => {
    try {
      const result = await getCropRecommendation(req.body);

      // ML microservice returns { crop, confidence, alternatives }
      const formattedResult = {
        crop: result.crop,
        confidence: result.confidence,
        alternatives: result.alternatives || [],
        timestamp: new Date().toISOString(),
      };

      const response = apiResponse.successResponse(
        formattedResult,
        "Crop recommendation generated successfully",
      );
      res.json(response);
    } catch (error) {
      console.error("Error fetching crop recommendation:", error.message);

      const isConnectionError =
        error.code === "ECONNREFUSED" ||
        error.message.includes("timeout") ||
        error.message.includes("Network Error");
      const status = isConnectionError ? 503 : 500;
      const errorCode = isConnectionError
        ? "ML_SERVICE_UNAVAILABLE"
        : "RECOMMENDATION_FAILED";
      const message = isConnectionError
        ? "Machine Learning recommendation service is currently offline or unreachable."
        : "Failed to retrieve recommendation from machine learning service.";

      const response = apiResponse.errorResponse(message, errorCode, status, {
        details: error.message,
      });
      res.status(status).json(response);
    }
  },
);

module.exports = router;
