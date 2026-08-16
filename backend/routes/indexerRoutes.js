const express = require("express");
const router = express.Router();
const indexerController = require("../controllers/indexerController");
const authMiddleware = require("../middleware/auth");

const protect = authMiddleware.protect || ((req, res, next) => next());
const adminOnly = authMiddleware.adminOnly || ((req, res, next) => next());

// Admin Endpoint: Force state reconciliation
router.post("/reconcile", protect, adminOnly, indexerController.reconcileState);

module.exports = router;
