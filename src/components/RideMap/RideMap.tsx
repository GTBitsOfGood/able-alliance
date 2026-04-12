"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import styles from "./RideMap.module.css";

export type RideMapLocation = {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
};

export type RideMapLiveMarker = {
  latitude: number;
  longitude: number;
  color?: string;
  label?: string;
  variant?: "pin" | "dot";
};

type RideMapProps = {
  locations: RideMapLocation[];
  pickupLocationId?: string | null;
  dropoffLocationId?: string | null;
  liveMarkers?: RideMapLiveMarker[];
  showOtherLocations?: boolean;
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
  onError?: (message: string) => void;
};

const DEFAULT_CENTER: [number, number] = [-84.3988077, 33.7760948];
const DEFAULT_ZOOM = 15;
const FRAME_PADDING = 80;
const MAX_FRAME_ZOOM = 16;
const OVERLAP_THRESHOLD_DEG = 0.0003;

function coordsOverlap(
  a: [number, number],
  b: [number, number],
  thresholdDeg = OVERLAP_THRESHOLD_DEG,
): boolean {
  return (
    Math.abs(a[0] - b[0]) < thresholdDeg && Math.abs(a[1] - b[1]) < thresholdDeg
  );
}

function isValidLngLat(
  longitude: number | undefined,
  latitude: number | undefined,
): longitude is number {
  return (
    typeof longitude === "number" &&
    typeof latitude === "number" &&
    Number.isFinite(longitude) &&
    Number.isFinite(latitude)
  );
}

function createCustomPin(
  labelText: string,
  color: string,
  extraStemPx = 0,
): HTMLDivElement {
  const root = document.createElement("div");
  root.className = styles.mapPinRoot;
  root.style.setProperty("--pin-color", color);

  const label = document.createElement("div");
  label.textContent = labelText;
  label.className = styles.mapPinLabel;

  const stem = document.createElement("div");
  stem.className = styles.mapPinStem;
  if (extraStemPx > 0) {
    stem.style.height = `calc(2.2rem + ${extraStemPx}px)`;
  }

  const dot = document.createElement("div");
  dot.className = styles.mapPinDot;

  root.appendChild(label);
  root.appendChild(stem);
  root.appendChild(dot);
  return root;
}

function createLocationDot(name: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = styles.mapLocationDotWrapper;

  const tooltip = document.createElement("div");
  tooltip.className = styles.mapDotTooltip;
  tooltip.textContent = name;

  const dot = document.createElement("div");
  dot.className = styles.mapLocationDot;

  wrapper.appendChild(tooltip);
  wrapper.appendChild(dot);
  return wrapper;
}

function createLiveDot(color: string): HTMLDivElement {
  const dot = document.createElement("div");
  dot.className = styles.mapLiveDot;
  dot.style.setProperty("--dot-color", color);
  return dot;
}

export default function RideMap({
  locations,
  pickupLocationId,
  dropoffLocationId,
  liveMarkers = [],
  showOtherLocations = false,
  className,
  defaultCenter = DEFAULT_CENTER,
  defaultZoom = DEFAULT_ZOOM,
  onError,
}: RideMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);
  const onErrorRef = useRef(onError);
  const initialCenterRef = useRef(defaultCenter);
  const initialZoomRef = useRef(defaultZoom);
  const [mapReady, setMapReady] = useState(false);

  const selectedLocations = useMemo(() => {
    const locationMap = new Map(
      locations.map((location) => [location._id, location]),
    );
    return {
      pickup: pickupLocationId
        ? (locationMap.get(pickupLocationId) ?? null)
        : null,
      dropoff: dropoffLocationId
        ? (locationMap.get(dropoffLocationId) ?? null)
        : null,
    };
  }, [dropoffLocationId, locations, pickupLocationId]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    const container = mapContainerRef.current;
    if (!container || !token || mapRef.current) return;

    try {
      mapboxgl.accessToken = token;

      const map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/streets-v12",
        center: initialCenterRef.current,
        zoom: initialZoomRef.current,
      });

      mapRef.current = map;

      const handleLoad = () => {
        map.resize();
        setMapReady(true);
      };

      if (map.loaded()) {
        handleLoad();
      } else {
        map.on("load", handleLoad);
      }
    } catch (error) {
      console.error("Failed to initialize ride map:", error);
      onErrorRef.current?.(
        error instanceof Error ? error.message : "Unable to load the ride map.",
      );
    }

    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    const framePoints: [number, number][] = [];
    const selectedIds = new Set(
      [pickupLocationId, dropoffLocationId].filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
    );

    if (showOtherLocations) {
      for (const location of locations) {
        if (selectedIds.has(location._id)) continue;
        if (!isValidLngLat(location.longitude, location.latitude)) continue;

        const marker = new mapboxgl.Marker({
          element: createLocationDot(location.name),
          anchor: "center",
        })
          .setLngLat([location.longitude, location.latitude])
          .addTo(map);

        markerRefs.current.push(marker);
      }
    }

    const pickupLngLat =
      selectedLocations.pickup &&
      isValidLngLat(
        selectedLocations.pickup.longitude,
        selectedLocations.pickup.latitude,
      )
        ? ([
            selectedLocations.pickup.longitude,
            selectedLocations.pickup.latitude,
          ] as [number, number])
        : null;
    const dropoffLngLat =
      selectedLocations.dropoff &&
      isValidLngLat(
        selectedLocations.dropoff.longitude,
        selectedLocations.dropoff.latitude,
      )
        ? ([
            selectedLocations.dropoff.longitude,
            selectedLocations.dropoff.latitude,
          ] as [number, number])
        : null;

    const overlap =
      pickupLngLat !== null &&
      dropoffLngLat !== null &&
      coordsOverlap(pickupLngLat, dropoffLngLat);

    if (selectedLocations.pickup && pickupLngLat) {
      const marker = new mapboxgl.Marker({
        element: createCustomPin(
          `Pickup: ${selectedLocations.pickup.name}`,
          "#183777",
        ),
        anchor: "bottom",
      })
        .setLngLat(pickupLngLat)
        .addTo(map);

      markerRefs.current.push(marker);
      framePoints.push(pickupLngLat);
    }

    if (selectedLocations.dropoff && dropoffLngLat) {
      const marker = new mapboxgl.Marker({
        element: createCustomPin(
          `Dropoff: ${selectedLocations.dropoff.name}`,
          "#183777",
          overlap ? 50 : 0,
        ),
        anchor: "bottom",
      })
        .setLngLat(dropoffLngLat)
        .addTo(map);

      markerRefs.current.push(marker);
      framePoints.push(dropoffLngLat);
    }

    for (const liveMarker of liveMarkers) {
      if (!isValidLngLat(liveMarker.longitude, liveMarker.latitude)) continue;

      const lngLat: [number, number] = [
        liveMarker.longitude,
        liveMarker.latitude,
      ];
      const color = liveMarker.color ?? "#2563eb";
      const variant = liveMarker.variant ?? "pin";
      const marker = new mapboxgl.Marker({
        element:
          variant === "dot"
            ? createLiveDot(color)
            : createCustomPin(liveMarker.label ?? "Live", color),
        anchor: variant === "dot" ? "center" : "bottom",
      })
        .setLngLat(lngLat)
        .addTo(map);

      markerRefs.current.push(marker);
      framePoints.push(lngLat);
    }

    map.resize();

    if (framePoints.length === 0) {
      map.easeTo({ center: defaultCenter, zoom: defaultZoom, duration: 0 });
      return;
    }

    if (framePoints.length === 1) {
      map.easeTo({ center: framePoints[0], zoom: defaultZoom, duration: 0 });
      return;
    }

    const bounds = new mapboxgl.LngLatBounds(framePoints[0], framePoints[0]);
    for (const point of framePoints.slice(1)) {
      bounds.extend(point);
    }

    map.fitBounds(bounds, {
      padding: FRAME_PADDING,
      maxZoom: MAX_FRAME_ZOOM,
      duration: 0,
    });
  }, [
    defaultCenter,
    defaultZoom,
    dropoffLocationId,
    liveMarkers,
    locations,
    mapReady,
    pickupLocationId,
    selectedLocations,
    showOtherLocations,
  ]);

  return (
    <div
      ref={mapContainerRef}
      className={`${styles.mapRoot} ${className ?? ""}`.trim()}
    />
  );
}
