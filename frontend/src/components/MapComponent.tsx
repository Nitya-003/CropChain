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
    .catch(err => console.error(err))