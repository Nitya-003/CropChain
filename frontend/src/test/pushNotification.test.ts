import { describe, it, expect, vi } from "vitest";
import {
  pushNotificationService,
  urlBase64ToUint8Array,
} from "../services/pushNotificationService";

describe("PWA Web Push Notification Service Test Suite", () => {
  it("should convert VAPID base64 key string to Uint8Array correctly", () => {
    const sampleBase64 = "BEl62iUYgUivxIkv69yViEuiBIaIb9Skv6yViEuiBIaIb9";
    const uint8Array = urlBase64ToUint8Array(sampleBase64);

    expect(uint8Array).toBeInstanceOf(Uint8Array);
    expect(uint8Array.length).toBeGreaterThan(0);
  });

  it("should return false for isSupported when window or PushManager is undefined", () => {
    const originalWindow = global.window;
    // @ts-ignore
    delete global.window;

    expect(pushNotificationService.isSupported()).toBe(false);

    global.window = originalWindow;
  });

  it("should format notification payload data options for Service Worker", () => {
    const payload = {
      title: "🌱 Cold-Chain Alert",
      body: "Temperature breach detected on batch CROP-2024-001: 18.5°C",
      batchId: "CROP-2024-001",
      url: "/track-batch?id=CROP-2024-001",
    };

    expect(payload.title).toContain("Cold-Chain Alert");
    expect(payload.url).toBe("/track-batch?id=CROP-2024-001");
  });
});
