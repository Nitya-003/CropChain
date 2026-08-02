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
    .catch(err => console.error(err))