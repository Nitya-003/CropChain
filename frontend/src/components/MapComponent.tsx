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
    if (!containerRef.current) return;

    import("leaflet").then((L) => {
      if (!containerRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
      });

      if (!mapRef.current) {
        const center = coordinates[0] || { lat: 20.5937, lng: 78.9629 };
        mapRef.current = L.map(containerRef.current).setView(
          [center.lat, center.lng],
          8
        );

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;

      markersRef.current.forEach((m) => map.removeLayer(m));
      markersRef.current = [];

      if (polylineRef.current) {
        map.removeLayer(polylineRef.current);
      }

      coordinates.forEach((pt, i) => {
        const marker = L.marker([pt.lat, pt.lng]).addTo(map);
        marker.bindPopup(
          `<b>Stop ${i + 1}</b><br/>${pt.address || "Location"}${
            pt.batchId ? `<br/>Batch: ${pt.batchId}` : ""
          }`
        );
        markersRef.current.push(marker);
      });

      if (geometry && geometry.length > 0) {
        const latLngs = geometry.map((g) => [g[0], g[1]] as [number, number]);
        polylineRef.current = L.polyline(latLngs, {
          color: "#16a34a",
          weight: 4,
          opacity: 0.8,
        }).addTo(map);
        map.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [coordinates, geometry]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[350px] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
    />
  );
};

export default MapComponent;