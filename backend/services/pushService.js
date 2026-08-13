const webpush = require("web-push");
const logger = require("../utils/logger");

// Initialize VAPID keys (Generate or fallback to dev keypair)
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-Skv6yViEuiBIa-Ib9",
  privateKey: process.env.VAPID_PRIVATE_KEY || "eUivxIkv69yViEuiBIa-Ib9-Skv6yViEuiBIa",
};

webpush.setVapidDetails(
  "mailto:support@cropchain.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// In-memory subscriptions store (Production uses MongoDB/Redis)
const pushSubscriptions = new Map();

const pushService = {
  getVapidPublicKey() {
    return vapidKeys.publicKey;
  },

  saveSubscription(userId, subscription) {
    if (!userId || !subscription || !subscription.endpoint) return;
    pushSubscriptions.set(userId, subscription);
    logger.info("Saved push notification subscription", { userId });
  },

  async sendNotification(userId, title, body, extraData = {}) {
    const subscription = pushSubscriptions.get(userId);
    if (!subscription) {
      logger.debug("No push subscription found for user", { userId });
      return false;
    }

    const payload = JSON.stringify({
      title: title || "🌱 CropChain Notification",
      body: body || "Supply chain batch update received.",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      ...extraData,
    });

    try {
      await webpush.sendNotification(subscription, payload);
      logger.info("Sent push notification successfully", { userId, title });
      return true;
    } catch (error) {
      logger.error("Failed to send push notification", { userId, error: error.message });
      if (error.statusCode === 410 || error.statusCode === 404) {
        pushSubscriptions.delete(userId);
      }
      return false;
    }
  },

  async broadcastBatchNotification(batchId, title, message) {
    let sentCount = 0;
    const payload = JSON.stringify({
      title,
      body: message,
      batchId,
      url: `/track-batch?id=${batchId}`,
    });

    for (const [userId, subscription] of pushSubscriptions.entries()) {
      try {
        await webpush.sendNotification(subscription, payload);
        sentCount++;
      } catch (error) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          pushSubscriptions.delete(userId);
        }
      }
    }

    logger.info("Broadcasted batch push notification", { batchId, sentCount });
    return sentCount;
  },
};

module.exports = pushService;
