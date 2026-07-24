"use client";
import React, { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

interface Waypoint {
  lat: number;
  lng: number;
  address?: string;
  type?: "start" | "pickup" | "dropoff";
  batchId?: string;
}

interface MapComponentProps {
  coordinates: Waypoint[];
  geometry: [number, number][];
}

const MapComponent: React.FC<MapComponentProps> = ({
  coordinates,
  geometry,
}) => {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const polylineRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  useEffect(() => {
    // Dynamically load leaflet on the client side to bypass Next.js SSR
    import("leaflet").then((L) => {
      // Fix leaflet marker icon issue in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });

      if (!containerRef.current) return;

      if (!mapRef.current) {
        // Center around India default or first coordinate if available
        const centerLat = coordinates.length > 0 ? coordinates[0].lat : 20.5937;
        const centerLng = coordinates.length > 0 ? coordinates[0].lng : 78.9629;

        mapRef.current = L.map(containerRef.current).setView(
          [centerLat, centerLng],
          8,
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;

      // Clear existing markers
      markersRef.current.forEach((marker) => map.removeLayer(marker));
      markersRef.current = [];

      // Clear existing polyline
      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
        polylineRef.current = null;
      }

      if (coordinates.length === 0) return;

      // Add markers
      const bounds = L.latLngBounds([]);

      coordinates.forEach((coord, index) => {
        let color = "#3b82f6"; // Start: Blue
        if (coord.type === "pickup") color = "#f59e0b"; // Pickup: Amber
        if (coord.type === "dropoff") color = "#10b981"; // Dropoff: Emerald

        // Custom HTML marker for premium look
        const markerHtml = `
          <div style="
            background-color: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 11px;
            font-weight: bold;
          ">
            ${index === 0 ? "S" : index}
          </div>
        `;

        const customIcon = L.divIcon({
          html: markerHtml,
          className: "custom-map-marker",
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const popupText = `
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
            <strong style="font-size: 13px; color: #1f2937;">Stop ${index === 0 ? "0 (Start)" : index}</strong><br/>
            <span style="color: #6b7280; font-weight: 500;">Type:</span> <span style="text-transform: uppercase; font-weight: bold; color: ${color};">${coord.type || "waypoint"}</span><br/>
            <span style="color: #6b7280; font-weight: 500;">Location:</span> ${coord.address || "Unknown Address"}<br/>
            ${coord.batchId ? `<span style="color: #6b7280; font-weight: 500;">Batch:</span> <code style="background: #f3f4f6; padding: 2px 4px; border-radius: 4px;">${coord.batchId.slice(0, 8)}...</code>` : ""}
          </div>
        `;

        const marker = L.marker([coord.lat, coord.lng], { icon: customIcon })
          .bindPopup(popupText)
          .addTo(map);

        markersRef.current.push(marker);
        bounds.extend([coord.lat, coord.lng]);
      });

      // Add polyline if geometry exists
      if (geometry && geometry.length > 0) {
        polylineRef.current = L.polyline(geometry, {
          color: "#4f46e5", // Indigo route line
          weight: 5,
          opacity: 0.85,
          lineJoin: "round",
        }).addTo(map);

        // Fit map bounds to the polyline
        map.fitBounds(polylineRef.current.getBounds(), { padding: [50, 50] });
      } else if (coordinates.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    });
  }, [coordinates, geometry]);

  // Cleanup map instance on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[450px] rounded-2xl overflow-hidden shadow-sm border border-border/80">
      <div ref={containerRef} className="w-full h-full min-h-[450px]" />
    </div>
  );
};

export default MapComponent;
