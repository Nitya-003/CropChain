// Custom Service Worker for CropChain PWA
// Using ES Module style supported by @ducanh2912/next-pwa

declare const self: ServiceWorkerGlobalScope;

// Install event
self.addEventListener("install", () => {
  console.log("[SW] Installed");
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("[SW] Activated");
  event.waitUntil(self.clients.claim());
});

// Sync event - triggered when connection is restored
self.addEventListener("sync", (event) => {
  console.log(`[SW] Sync event triggered: ${event.tag}`);

  // Tag names used by workbox-background-sync or custom tags
  if (event.tag === "sync-queue" || event.tag.includes("sync")) {
    event.waitUntil(notifyClientsOfOnlineSync());
  }
});

// Listen for message events from client pages
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // Allow client to manually request sync event simulation
  if (event.data.type === "REQUEST_SYNC_FLUSH") {
    console.log("[SW] Received REQUEST_SYNC_FLUSH message");
    event.waitUntil(notifyClientsOfOnlineSync());
  }
});

// Helper function to broadcast online sync trigger to all open tabs
async function notifyClientsOfOnlineSync() {
  const clients = await self.clients.matchAll({ type: "window" });
  console.log(`[SW] Broadcasting SW_ONLINE_SYNC to ${clients.length} clients`);

  for (const client of clients) {
    client.postMessage({
      type: "SW_ONLINE_SYNC",
      timestamp: Date.now(),
    });
  }
}
