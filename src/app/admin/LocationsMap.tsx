"use client";

import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import type { Location } from "@db/generated/browser";

export type LngLat = { longitude: number; latitude: number };

const DEFAULT_CENTER: [number, number] = [-84.3988077, 33.7760948];
const DEFAULT_ZOOM = 15;

const MAP_CLASS =
  "w-full h-[40rem] border border-[var(--color-grey-stroke-weak)] rounded-[0.8rem] overflow-hidden";

interface LocationsMapProps {
  /** Existing locations, each rendered as a dot with a hover label. */
  locations: Location[];
  /** Point to mark with a pin, e.g. the location being created. */
  selected?: LngLat | null;
  /** When provided, clicking the map reports the clicked coordinates. */
  onSelect?: (point: LngLat) => void;
  className?: string;
}

function createLocationDot(name: string): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = "group flex items-center justify-center overflow-visible";

  const tooltip = document.createElement("div");
  tooltip.className =
    "absolute bottom-[calc(100%+0.5rem)] left-1/2 -translate-x-1/2 z-10 px-[0.8rem] py-[0.4rem] rounded-[1.2rem] border border-[var(--color-grey-text-strong)] bg-[var(--color-brand-text)] text-[var(--color-solid-bg-base)] text-[1.1rem] font-semibold font-paragraph whitespace-nowrap pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100";
  tooltip.textContent = name;

  const dot = document.createElement("div");
  dot.className =
    "w-[1.5rem] h-[1.5rem] rounded-full border-[0.2rem] border-[var(--color-grey-text-strong)] bg-[var(--color-map-location-fill)]";

  wrapper.appendChild(tooltip);
  wrapper.appendChild(dot);
  return wrapper;
}

function createPin(labelText: string): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "flex flex-col items-center";

  const label = document.createElement("div");
  label.className =
    "px-[1.1rem] py-[0.45rem] rounded-[1.6rem] border-[0.2rem] border-[var(--color-grey-text-strong)] bg-[var(--color-map-pin)] text-[var(--color-solid-bg-base)] text-[1.1rem] leading-[1.4rem] font-bold font-paragraph whitespace-nowrap";
  label.textContent = labelText;

  const stem = document.createElement("div");
  stem.className = "w-[0.2rem] h-[2.2rem] bg-[var(--color-map-pin)]";

  const dot = document.createElement("div");
  dot.className =
    "w-[1.4rem] h-[1.4rem] rounded-full border-[0.2rem] border-[var(--color-grey-text-strong)] bg-[var(--color-map-pin)]";

  root.appendChild(label);
  root.appendChild(stem);
  root.appendChild(dot);
  return root;
}

export default function LocationsMap({
  locations,
  selected,
  onSelect,
  className,
}: LocationsMapProps) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const dotMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const pinMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const selectable = Boolean(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !token) return;

    let map: mapboxgl.Map;
    try {
      mapboxgl.accessToken = token;
      map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/streets-v12",
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      });
    } catch (e) {
      // Surface failures from the external map API to the user.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapError(e instanceof Error ? e.message : "Unknown error");
      return;
    }
    mapRef.current = map;

    map.on("load", () => {
      map.resize();
      setMapLoaded(true);
    });
    map.on("click", (e) => {
      onSelectRef.current?.({
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
      });
    });

    return () => {
      dotMarkersRef.current.forEach((marker) => marker.remove());
      dotMarkersRef.current = [];
      pinMarkerRef.current?.remove();
      pinMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.getCanvas().style.cursor = selectable ? "crosshair" : "";
  }, [mapLoaded, selectable]);

  // Draw a dot for every location and frame them all in view.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    dotMarkersRef.current.forEach((marker) => marker.remove());
    dotMarkersRef.current = locations.map((loc) =>
      new mapboxgl.Marker({
        element: createLocationDot(loc.name),
        anchor: "center",
      })
        .setLngLat([loc.longitude, loc.latitude])
        .addTo(map),
    );

    if (locations.length === 1) {
      map.jumpTo({
        center: [locations[0].longitude, locations[0].latitude],
        zoom: DEFAULT_ZOOM,
      });
    } else if (locations.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      for (const loc of locations) bounds.extend([loc.longitude, loc.latitude]);
      map.fitBounds(bounds, {
        padding: 64,
        maxZoom: DEFAULT_ZOOM,
        duration: 0,
      });
    }
  }, [mapLoaded, locations]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    if (!selected) {
      pinMarkerRef.current?.remove();
      pinMarkerRef.current = null;
      return;
    }
    const lngLat: [number, number] = [selected.longitude, selected.latitude];
    if (pinMarkerRef.current) {
      pinMarkerRef.current.setLngLat(lngLat);
    } else {
      pinMarkerRef.current = new mapboxgl.Marker({
        element: createPin("New location"),
        anchor: "bottom",
      })
        .setLngLat(lngLat)
        .addTo(map);
    }
  }, [mapLoaded, selected]);

  if (!token || mapError) {
    return (
      <div
        className={`${MAP_CLASS} flex items-center justify-center text-[1.4rem] font-paragraph text-[var(--color-grey-text-weak)] ${className ?? ""}`}
      >
        {mapError
          ? `Unable to load map. ${mapError}`
          : "Map unavailable: NEXT_PUBLIC_MAPBOX_TOKEN is not set."}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`${MAP_CLASS} ${className ?? ""}`} />
  );
}
