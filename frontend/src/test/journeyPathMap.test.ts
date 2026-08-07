import { describe, it, expect } from "vitest";
import { geocodeAddress } from "../utils/geocoding";

describe("Leaflet GIS Journey Path Map & Geocoding Test Suite", () => {
  it("should resolve known location strings into latitude/longitude coordinates", async () => {
    const coords1 = await geocodeAddress("Sonipat, Haryana");
    const coords2 = await geocodeAddress("Ludhiana Central Mandi");

    expect(coords1).toBeDefined();
    expect(coords1.lat).toBeTypeOf("number");
    expect(coords1.lng).toBeTypeOf("number");

    expect(coords2).toBeDefined();
    expect(coords2.lat).toBeTypeOf("number");
    expect(coords2.lng).toBeTypeOf("number");
  });

  it("should fallback to default center coordinates when location is unknown", async () => {
    const coords = await geocodeAddress("Unknown Remote Location XYZ 123");
    expect(coords).toBeDefined();
    expect(coords.lat).toBeGreaterThan(0);
    expect(coords.lng).toBeGreaterThan(0);
  });
});
