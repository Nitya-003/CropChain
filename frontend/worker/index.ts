// Custom Service Worker for CropChain PWA
// Using ES Module style supported by @ducanh2912/next-pwa

const sw = self as any;

// Install event
sw.addEventListener("install", () => {
  console.log("[SW] Installed");
  sw.skipWaiting();
});

// Activate event
sw.addEventListener("activate", (event: any) => {
  console.log("[SW] Activated");
  event.waitUntil(sw.clients.claim());
});

// Sync event - triggered when connection is restored
sw.addEventListener("sync", (event: any) => {
  console.log(`[SW] Sync event triggered: ${event.tag}`);

  // Tag names used by workbox-background-sync or custom tags
  if (event.tag === "sync-queue" || event.tag.includes("sync")) {
    event.waitUntil(notifyClientsOfOnlineSync());
  }
});

// Listen for message events from client pages
sw.addEventListener("message", (event: any) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    sw.skipWaiting();
  }

  // Allow client to manually request sync event simulation
  if (event.data.type === "REQUEST_SYNC_FLUSH") {
    console.log("[SW] Received REQUEST_SYNC_FLUSH message");
    event.waitUntil(notifyClientsOfOnlineSync());
  }
});

// Push notification event listener
sw.addEventListener("push", (event: any) => {
  console.log("[SW] Push event received", event);

  let data = {
    title: "🌱 CropChain Notification",
    body: "A batch status update occurred in your supply chain.",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    url: "/track-batch",
    batchId: undefined,
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || "/icons/icon-192x192.png",
    badge: data.badge || "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || (data.batchId ? `/track-batch?id=${data.batchId}` : "/track-batch"),
      dateOfArrival: Date.now(),
    },
    actions: [
      { action: "explore", title: "View Details" },
      { action: "close", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    sw.registration.showNotification(data.title, notificationOptions)
  );
});

// Notification click event listener
sw.addEventListener("notificationclick", (event: any) => {
  console.log("[SW] Notification click received", event);
  event.notification.close();

  if (event.action === "close") return;

  const targetUrl = event.notification.data?.url || "/track-batch";

  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList: any[]) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && "focus" in client) {
          return client.focus();
        }
      }
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(targetUrl);
      }
    })
  );
});

// Helper function to broadcast online sync trigger to all open tabs
async function notifyClientsOfOnlineSync() {
  const clients = await sw.clients.matchAll({ type: "window" });
  console.log(`[SW] Broadcasting SW_ONLINE_SYNC to ${clients.length} clients`);

  for (const client of clients) {
    client.postMessage({
      type: "SW_ONLINE_SYNC",
      timestamp: Date.now(),
    });
  }
}
