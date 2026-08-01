/**
 * Geocoding Utility for CropChain
 * Converts address strings to geographic coordinates (lat, lng)
 * Utilizes OpenStreetMap Nominatim with memory + localStorage caching
 * and deterministic fallbacks for mock addresses.
 */

interface Coordinates {
  lat: number;
  lng: number;
}

// In-memory cache for the session
const memoryCache: Record<string, Coordinates> = {};

// Common Indian city/region coordinates mapping for fast keyword lookup
const KEYWORD_MAP: Array<{ keywords: string[]; coords: Coordinates }> = [
  {
    keywords: ["bangalore", "bengaluru", "blr"],
    coords: { lat: 12.9716, lng: 77.5946 },
  },
  {
    keywords: ["mumbai", "bombay", "mumb"],
    coords: { lat: 19.076, lng: 72.8777 },
  },
  {
    keywords: ["delhi", "new delhi", "ncr"],
    coords: { lat: 28.6139, lng: 77.209 },
  },
  {
    keywords: ["punjab", "amritsar", "ludhiana"],
    coords: { lat: 31.1471, lng: 75.3412 },
  },
  {
    keywords: ["haryana", "gurgaon", "panipat"],
    coords: { lat: 29.0588, lng: 76.0856 },
  },
  { keywords: ["pune", "maharashtra"], coords: { lat: 18.5204, lng: 73.8567 } },
  { keywords: ["chennai", "madras"], coords: { lat: 13.0827, lng: 80.2707 } },
  {
    keywords: ["hyderabad", "secunderabad"],
    coords: { lat: 17.385, lng: 78.4867 },
  },
  { keywords: ["kolkata", "calcutta"], coords: { lat: 22.5726, lng: 88.3639 } },
  { keywords: ["hub", "central"], coords: { lat: 12.9716, lng: 77.5946 } }, // Default to Bangalore hub
];

/**
 * Generates deterministic coordinates for any address string to serve as a robust fallback.
 * Uses a string hash function to calculate slightly offset coordinates from matching region
 * or general India center, ensuring that different address strings map to distinct spots.
 */
export const getDeterministicFallback = (address: string): Coordinates => {
  const cleanAddress = address.toLowerCase().trim();
  let baseCoords = { lat: 20.5937, lng: 78.9629 }; // Default: India Center
  let isRegional = false;

  // 1. Try to find a matching base region
  for (const mapping of KEYWORD_MAP) {
    if (mapping.keywords.some((keyword) => cleanAddress.includes(keyword))) {
      baseCoords = { ...mapping.coords };
      isRegional = true;
      break;
    }
  }

  // 2. Generate a deterministic hash from the address string
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = address.charCodeAt(i) + ((hash << 5) - hash);
  }

  // 3. Scale offset depending on whether we matched a regional city or not
  // For matched cities, we want a small local spread (within ~10km / 0.08 degrees)
  // For general fallback, we spread across India (within ~800km / 7 degrees)
  const spread = isRegional ? 0.08 : 7.0;
  const latOffset = (Math.abs(hash % 1000) / 1000) * spread - spread / 2;
  const lngOffset = (Math.abs((hash >> 3) % 1000) / 1000) * spread - spread / 2;

  return {
    lat: baseCoords.lat + latOffset,
    lng: baseCoords.lng + lngOffset,
  };
};

/**
 * Geocodes an address string using Nominatim API with multiple cache layers
 * and a robust deterministic fallback.
 */
export const geocodeAddress = async (address: string): Promise<Coordinates> => {
  if (!address || typeof address !== "string" || !address.trim()) {
    return { lat: 20.5937, lng: 78.9629 }; // India center default
  }

  const query = address.trim();

  // 1. Check in-memory cache
  if (memoryCache[query]) {
    return memoryCache[query];
  }

  // 2. Check localStorage cache
  try {
    const cached = localStorage.getItem(`geocode_cache_${query}`);
    if (cached) {
      const coords = JSON.parse(cached);
      memoryCache[query] = coords;
      return coords;
    }
  } catch (e) {
    // Ignore localStorage block/quota issues
  }

  // 3. Fetch from OpenStreetMap Nominatim API
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        "User-Agent": "CropChain-Supply-Chain-Tracker/1.0",
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const coords = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        };

        // Cache the result
        memoryCache[query] = coords;
        try {
          localStorage.setItem(
            `geocode_cache_${query}`,
            JSON.stringify(coords),
          );
        } catch (e) {
          // Ignore write failure
        }

        return coords;
      }
    }
  } catch (error) {
    console.warn(
      `Nominatim geocoding failed for "${query}", using deterministic fallback.`,
      error,
    );
  }

  // 4. Fallback to deterministic coordinates if API fails or returns no results
  const fallbackCoords = getDeterministicFallback(query);

  // Cache the fallback to prevent re-hashing
  memoryCache[query] = fallbackCoords;
  return fallbackCoords;
};
