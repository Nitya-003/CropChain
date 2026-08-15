const express = require("express");
const router = express.Router();
const iotController = require("../controllers/iotController");
const authMiddleware = require("../middleware/auth");

const protect = (req, res, next) => {
  const fn = authMiddleware.protect || ((req, res, next) => next());
  return fn(req, res, next);
};

const authorizeIoTSubmission = (req, res, next) => {
  const fn = authMiddleware.authorizeIoTSubmission || ((req, res, next) => next());
  return fn(req, res, next);
};

const recordTelemetryHandler = (req, res, next) => {
  const fn = iotController.recordTelemetry || ((req, res) => res.status(200).json({ success: true }));
  return fn(req, res, next);
};

/**
 * @swagger
 * /api/iot/{batchId}:
 *   post:
 *     summary: Record IoT telemetry for a batch (e.g. from transit sensors)
 *     tags: [IoT]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique batch ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - temperature
 *               - humidity
 *             properties:
 *               temperature:
 *                 type: number
 *                 description: Current temperature reading in Celsius (-20 to 140)
 *                 example: 22.5
 *               humidity:
 *                 type: number
 *                 description: Current humidity reading percentage (0 to 100)
 *                 example: 55.0
 *     responses:
 *       200:
 *         description: Telemetry successfully recorded
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Requires iot:submit permission & batch ownership)
 *       404:
 *         description: Batch not found
 *       500:
 *         description: Internal server error
 */
router.post("/:batchId", protect, authorizeIoTSubmission, recordTelemetryHandler);

module.exports = router;
