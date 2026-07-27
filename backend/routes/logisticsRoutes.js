"use strict";

const express = require("express");
const router = express.Router();
const { optimizeRoute } = require("../services/logisticsService");
const { optimizeRouteSchema } = require("../validations/logisticsSchema");
const validateRequest = require("../middleware/validator");
const apiResponse = require("../utils/apiResponse");
const { protect } = require("../middleware/auth");
const logger = require("../utils/logger");

/**
 * @swagger
 * /api/logistics/optimize-route:
 *   post:
 *     summary: Optimize route for multiple pickups and dropoffs
 *     tags: [Logistics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - coordinates
 *             properties:
 *               coordinates:
 *                 type: array
 *                 description: List of coordinates to visit. The first coordinate is treated as the starting point.
 *                 items:
 *                   type: object
 *                   required:
 *                     - lat
 *                     - lng
 *                   properties:
 *                     lat:
 *                       type: number
 *                       description: Latitude (-90 to 90)
 *                     lng:
 *                       type: number
 *                       description: Longitude (-180 to 180)
 *                     address:
 *                       type: string
 *                       description: Optional description of the location
 *                     type:
 *                       type: string
 *                       enum: [start, pickup, dropoff]
 *                     batchId:
 *                       type: string
 *                       description: Optional crop batch ID
 *     responses:
 *       200:
 *         description: Route optimized successfully
 *       400:
 *         description: Validation failed or invalid coordinates
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Optimization service failed
 */
router.post(
  "/optimize-route",
  protect,
  validateRequest(optimizeRouteSchema),
  async (req, res, next) => {
    try {
      const { coordinates } = req.body;

      logger.info("Optimizing route for transporter", {
        userId: req.user.id,
        stopsCount: coordinates.length,
      });

      const result = await optimizeRoute(coordinates);

      const response = apiResponse.successResponse(
        result,
        "Multi-stop route optimized successfully",
      );
      res.json(response);
    } catch (error) {
      logger.error("Error optimizing logistics route", {
        error: error.message,
        stack: error.stack,
      });

      const response = apiResponse.errorResponse(
        error.message || "Failed to optimize route",
        "ROUTE_OPTIMIZATION_FAILED",
        500,
      );
      res.status(500).json(response);
    }
  },
);

module.exports = router;
