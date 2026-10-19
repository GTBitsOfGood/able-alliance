"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useRouteUpdates,
  type RouteChanges,
} from "@/components/NotificationProvider/useRouteUpdates";

export type RouteEntry = {
  _id: string;
  student: { firstName: string; lastName: string };
  pickupLocation: string;
  dropoffLocation: string;
  scheduledPickupTime: string;
  status: string;
};

export type DriverEntry = { _id: string; firstName: string; lastName: string };
export type VehicleEntry = { _id: string; name: string; licensePlate: string };
type LocationEntry = { _id: string; name: string };

const REQUESTED = "Requested";

// `routeIds: null` reloads the whole list; otherwise only those rows.
type Job = { routeIds: Set<string> | null };

async function fetchJson(url: string, label: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${label} API ${res.status}`);
  return res.json();
}

// Null means the route no longer exists, e.g. it was deleted.
async function fetchRoute(id: string): Promise<RouteEntry | null> {
  const res = await fetch(`/api/routes/${id}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Route API ${res.status}`);
  return res.json();
}

function asArray<T>(data: unknown): T[] {
  return Array.isArray(data) ? data : [];
}

/**
 * Replaces the given rows with their fetched versions, dropping any that are
 * gone or no longer requested. Existing rows keep their position and newly
 * requested ones are added at the end.
 */
function mergeRows(
  prev: RouteEntry[],
  fetched: Map<string, RouteEntry | null>,
): RouteEntry[] {
  const keep = (r: RouteEntry | null | undefined): r is RouteEntry =>
    r?.status === REQUESTED;
  const next = prev
    .map((r) => (fetched.has(r._id) ? fetched.get(r._id) : r))
    .filter(keep);
  const present = new Set(prev.map((r) => r._id));
  for (const [id, r] of fetched) {
    if (!present.has(id) && keep(r)) next.push(r);
  }
  return next;
}

/**
 * Loads the requested rides for the admin table, plus the drivers, vehicles
 * and locations it needs, and keeps the rides current from real-time events:
 * changed rows are refetched one by one, and the full list is only reloaded
 * after a (re)connect.
 */
export function useRequestedRides() {
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [drivers, setDrivers] = useState<DriverEntry[]>([]);
  const [vehicles, setVehicles] = useState<VehicleEntry[]>([]);
  const [locationMap, setLocationMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // Blocks the table: nothing has loaded successfully yet.
  const [error, setError] = useState<string | null>(null);
  // A failed background refresh keeps the current rows and only shows this.
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const aliveRef = useRef(true);
  const loadedRef = useRef(false);
  // Jobs run one at a time, so an older response can never be applied after
  // a newer one. Changes that arrive meanwhile are merged into `pendingRef`
  // and handled by the next run.
  const pendingRef = useRef<Job | null>(null);
  const runningRef = useRef(false);

  const run = useCallback(async ({ routeIds }: Job) => {
    try {
      // Rows can only be patched into a list that has loaded once.
      if (routeIds && loadedRef.current) {
        const ids = [...routeIds];
        const rows = await Promise.all(ids.map(fetchRoute));
        if (!aliveRef.current) return;
        const fetched = new Map(ids.map((id, i) => [id, rows[i]]));
        setRoutes((prev) => mergeRows(prev, fetched));
      } else if (loadedRef.current) {
        const routesData = await fetchJson(
          `/api/routes?status=${REQUESTED}`,
          "Routes",
        );
        if (!aliveRef.current) return;
        setRoutes(asArray(routesData));
      } else {
        const [routesData, locationsData, driversData, vehiclesData] =
          await Promise.all([
            fetchJson(`/api/routes?status=${REQUESTED}`, "Routes"),
            fetchJson("/api/locations", "Locations"),
            fetchJson("/api/users?type=Driver", "Drivers"),
            fetchJson("/api/vehicles", "Vehicles"),
          ]);
        if (!aliveRef.current) return;
        const locMap: Record<string, string> = {};
        for (const loc of asArray<LocationEntry>(locationsData)) {
          locMap[String(loc._id)] = String(loc.name);
        }
        setRoutes(asArray(routesData));
        setLocationMap(locMap);
        setDrivers(asArray(driversData));
        setVehicles(asArray(vehiclesData));
        loadedRef.current = true;
      }
      setError(null);
      setRefreshError(null);
    } catch (e) {
      if (!aliveRef.current) return;
      const message = e instanceof Error ? e.message : "Failed to load rides.";
      if (loadedRef.current) {
        setRefreshError(
          `Couldn't refresh rides (${message}). Showing the last loaded data.`,
        );
      } else {
        setError(message);
      }
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  const enqueue = useCallback(
    (job: Job) => {
      const pending = pendingRef.current;
      if (!pending) {
        pendingRef.current = job;
      } else if (!pending.routeIds || !job.routeIds) {
        pendingRef.current = { routeIds: null };
      } else {
        for (const id of job.routeIds) pending.routeIds.add(id);
      }
      if (runningRef.current) return;

      runningRef.current = true;
      void (async () => {
        try {
          while (pendingRef.current) {
            const next = pendingRef.current;
            pendingRef.current = null;
            await run(next);
          }
        } finally {
          runningRef.current = false;
        }
      })();
    },
    [run],
  );

  useEffect(() => {
    aliveRef.current = true;
    enqueue({ routeIds: null });
    return () => {
      aliveRef.current = false;
    };
  }, [enqueue]);

  useRouteUpdates(({ routeIds }: RouteChanges) => {
    enqueue({ routeIds: routeIds && new Set(routeIds) });
  });

  // Drops a row right away after this admin assigns or cancels it, without
  // waiting for the real-time event.
  const removeRoute = useCallback((routeId: string) => {
    setRoutes((prev) => prev.filter((r) => r._id !== routeId));
  }, []);

  return {
    routes,
    drivers,
    vehicles,
    locationMap,
    loading,
    error,
    refreshError,
    removeRoute,
  };
}
