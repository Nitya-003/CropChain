const express = require("express");
const router = express.Router();
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  registerPushToken,
} = require("../controllers/notificationController");
const { protect } = require("../middleware/auth");
const { notificationLimiter } = require("../middleware/rateLimiters");

const pushService = require("../services/pushService");
const apiResponse = require("../utils/apiResponse");

// Public route for fetching VAPID public key
router.get("/vapid-key", (req, res) => {
  res.json(apiResponse.successResponse({ publicKey: pushService.getVapidPublicKey() }, "VAPID public key retrieved"));
});

// All other notification routes require authentication
router.use(protect);
router.use(notificationLimiter);

router.get("/", getUserNotifications);
router.get("/unread-count", getUnreadCount);
router.post("/push-token", registerPushToken);
router.put("/read-all", markAllAsRead);
router.put("/:id/read", markAsRead);

// Web Push subscription endpoint
router.post("/subscribe", (req, res) => {
  const { subscription } = req.body;
  if (!subscription) {
    return res.status(400).json(apiResponse.errorResponse("Subscription payload is required", "INVALID_INPUT", 400));
  }

  pushService.saveSubscription(req.user?.id || "guest", subscription);
  res.json(apiResponse.successResponse(null, "Push subscription registered successfully"));
});

module.exports = router;
