import React, { useState, useEffect, useRef } from "react";
import { Navigation, Info, MapPin, Loader2 } from "lucide-react";
import { StageUpdate } from "./JourneyStageNode";
import { useTranslation } from "react-i18next";
import { geocodeAddress } from "../../utils/geocoding";
import "leaflet/dist/leaflet.css";

interface JourneyPathMapProps {
  updates: StageUpdate[];
  selectedUpdateIndex: number;
  onSelectUpdate: (update: StageUpdate, index: number) => void;
}

interface Coordinates {
  lat: number;
  lng: number;
}

export const JourneyPathMap: React.FC<JourneyPathMapProps> = ({
  updates,
  selectedUpdateIndex,
  onSelectUpdate,
}) => {
  const { t } = useTranslation();
  const [coordsList, setCoordsList] = useState<Coordinates[]>([]);
  const [isResolving, setIsResolving] = useState(true);

  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const polylineRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  // 1. Resolve coordinates asynchronously on mount or when updates change
  useEffect(() => {
    let active = true;
    const resolveCoordinates = async () => {
      if (!updates || updates.length === 0) {
        setIsResolving(false);
        return;
      }
      setIsResolving(true);
      try {
        const resolved = await Promise.all(
          updates.map((update) => geocodeAddress(update.location)),
        );
        if (active) {
          setCoordsList(resolved);
        }
      } catch (err) {
        console.error("Failed to geocode journey locations:", err);
      } finally {
        if (active) {
          setIsResolving(false);
        }
      }
    };

    resolveCoordinates();
    return () => {
      active = false;
    };
  }, [updates]);

  // 2. Initialize Leaflet map and render elements once coordinates are resolved
  useEffect(() => {
    if (isResolving || coordsList.length === 0 || !containerRef.current) return;

    // Dynamically load leaflet on the client side
    import("leaflet").then((L) => {
      // Fix leaflet default marker icon issue in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });

      // Initialize map instance if not already done
      if (!mapRef.current) {
        const center = coordsList[0] || { lat: 20.5937, lng: 78.9629 };
        mapRef.current = L.map(containerRef.current!).setView(
          [center.lat, center.lng],
          6,
        );

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;

      // Ensure leaflet recalculates map dimensions to avoid partial tiles
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);

      // Clear existing markers from previous render
      markersRef.current.forEach((marker) => map.removeLayer(marker));
      markersRef.current = [];

      // Clear existing polyline
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }

      const bounds = L.latLngBounds([]);

      // Plot markers for each coordinate/waypoint
      coordsList.forEach((coords, index) => {
        const update = updates[index];
        if (!update) return;

        const isSelected = index === selectedUpdateIndex;
        const isCurrent = index === updates.length - 1;

        // Stage colors matching design guidelines
        let pinColor = "#10b981"; // Completed / Default
        if (update.stage === "farmer") pinColor = "#22c55e"; // Green
        if (update.stage === "mandi") pinColor = "#a855f7"; // Purple
        if (update.stage === "transport") pinColor = "#f97316"; // Orange
        if (update.stage === "retailer") pinColor = "#06b6d4"; // Cyan

        // Custom HTML marker matching premium apple-level looks
        const markerHtml = `
          <div style="
            background-color: ${pinColor};
            width: ${isSelected ? "28px" : "22px"};
            height: ${isSelected ? "28px" : "22px"};
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 10px;
            font-weight: bold;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            transform: scale(${isSelected ? "1.15" : "1"});
          ">
            ${index + 1}
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: "custom-map-marker-node",
          iconSize: isSelected ? [28, 28] : [22, 22],
          iconAnchor: isSelected ? [14, 14] : [11, 11],
        });

        // Detail Popup Card
        const popupText = `
          <div style="font-family: system-ui, -apple-system, sans-serif; font-size: 12px; line-height: 1.5; padding: 4px; min-width: 170px;">
            <div style="font-size: 11px; font-weight: bold; color: ${pinColor}; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.05em;">
              Stage: ${update.stage}
            </div>
            <div style="font-size: 13px; font-weight: 700; color: #1f2937; margin-bottom: 4px;">
              ${update.location}
            </div>
            <div style="color: #4b5563; margin-bottom: 2px;">
              <strong>Handler:</strong> ${update.actor}
            </div>
            <div style="color: #6b7280; font-size: 10px;">
              <strong>Time:</strong> ${new Date(update.timestamp).toLocaleString()}
            </div>
            ${
              update.notes
                ? `
              <div style="margin-top: 6px; padding-top: 4px; border-t border-gray-100 italic color: #4b5563; font-size: 11px;">
                "${update.notes}"
              </div>
            `
                : ""
            }
          </div>
        `;

        const marker = L.marker([coords.lat, coords.lng], { icon: customIcon })
          .bindPopup(popupText, { closeButton: false, offset: [0, -5] })
          .addTo(map);

        // Click handler syncs selection to parent timeline
        marker.on("click", () => {
          onSelectUpdate(update, index);
        });

        markersRef.current.push(marker);
        bounds.extend([coords.lat, coords.lng]);

        // Auto-open popup on the currently selected waypoint
        if (isSelected) {
          setTimeout(() => {
            if (mapRef.current && marker) {
              marker.openPopup();
            }
          }, 50);
        }
      });

      // Draw polyline connecting coordinates
      if (coordsList.length >= 2) {
        polylineRef.current = L.polyline(
          coordsList.map((c) => [c.lat, c.lng]),
          {
            color: "#4f46e5", // Premium Indigo
            weight: 4,
            opacity: 0.8,
            lineJoin: "round",
            className: "journey-svg-path", // CSS animated dashed flowing lines
          },
        ).addTo(map);
      }

      // Smooth pan to active coordinate when selection changes
      const activeCoords = coordsList[selectedUpdateIndex];
      if (activeCoords) {
        map.panTo([activeCoords.lat, activeCoords.lng], {
          animate: true,
          duration: 0.8,
        });
        const activeMarker = markersRef.current[selectedUpdateIndex];
        if (activeMarker) {
          activeMarker.openPopup();
        }
      } else if (coordsList.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    });
  }, [isResolving, coordsList, selectedUpdateIndex, updates, onSelectUpdate]);

  // Clean up map instance on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="journey-glass-card rounded-2xl p-6 flex flex-col h-full relative overflow-hidden">
      <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-800 pb-3">
        <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2 text-lg">
          <Navigation className="h-5 w-5 text-green-600 dark:text-green-400 rotate-45" />
          <span>{t("journey.journey_path", "Geographic Transit Map")}</span>
        </h3>
        <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center gap-1">
          <Info className="h-3 w-3" />
          Interactive Nodes
        </span>
      </div>

      {/* Map Container */}
      <div className="relative flex-1 bg-gradient-to-br from-green-50/20 to-blue-50/20 dark:from-gray-900/40 dark:to-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl min-h-[300px] overflow-hidden flex items-center justify-center">
        {/* Loading overlay */}
        {isResolving && (
          <div className="absolute inset-0 z-[1000] flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-green-600 dark:text-green-400" />
            <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              Resolving geospatial checkpoints...
            </p>
          </div>
        )}

        {updates.length === 0 ? (
          <div className="text-gray-400 dark:text-gray-500 font-medium">
            No transit data available
          </div>
        ) : (
          <div
            ref={containerRef}
            className="w-full h-full absolute inset-0 z-0"
            style={{ minHeight: "300px" }}
          />
        )}
      </div>

      {/* Selected Location Quick Glance */}
      {!isResolving && updates[selectedUpdateIndex] && (
        <div className="mt-4 bg-gray-50 dark:bg-gray-800/40 rounded-xl p-3 border border-gray-100 dark:border-gray-800 text-left text-xs sm:text-sm">
          <div className="flex gap-2 items-center text-gray-500 mb-1 font-semibold uppercase tracking-wider text-[10px]">
            <MapPin className="h-3.5 w-3.5 text-blue-500" />
            <span>Checkpoint Details</span>
          </div>
          <div className="text-gray-800 dark:text-gray-200 font-semibold truncate">
            {updates[selectedUpdateIndex].location}
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
            {updates[selectedUpdateIndex].actor} •{" "}
            {new Date(updates[selectedUpdateIndex].timestamp).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};
