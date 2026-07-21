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
