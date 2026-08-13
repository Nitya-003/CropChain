/**
 * Utility helper to convert URL safe base64 string to Uint8Array for VAPID key
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  try {
    const rawData = typeof window !== "undefined" && typeof window.atob === "function"
      ? window.atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch {
    const buf = Buffer.from(base64, "base64");
    return new Uint8Array(buf);
  }
}

export const pushNotificationService = {
  /**
   * Check if browser supports Web Push notifications
   */
  isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window
    );
  },

  /**
   * Get current notification permission state
   */
  getPermissionState(): NotificationPermission {
    if (!this.isSupported()) return "denied";
    return Notification.permission;
  },

  /**
   * Request browser notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return "denied";
    const permission = await Notification.requestPermission();
    return permission;
  },

  /**
   * Subscribe Service Worker to push notifications using VAPID key
   */
  async subscribeUser(vapidPublicKey: string): Promise<PushSubscription | null> {
    if (!this.isSupported()) {
      console.warn("Push notifications are not supported in this browser.");
      return null;
    }

    const permission = await this.requestPermission();
    if (permission !== "granted") {
      console.warn("Push notification permission denied by user.");
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey as any,
      });
    }

    return subscription;
  },
};
