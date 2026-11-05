"use client";

import { RouteStatus } from "@db/generated/enums";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouteUpdates } from "@/hooks/useRouteUpdates";
import type { RouteChanges } from "@/types/notifications";

import type { RouteEntry, DriverEntry, VehicleEntry } from "@/types/admin";

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
 * gone. Existing rows keep their position and newly seen ones are added at
 * the end.
 */
function mergeRows(
  prev: RouteEntry[],
  fetched: Map<string, RouteEntry | null>,
): RouteEntry[] {
  const keep = (r: RouteEntry | null | undefined): r is RouteEntry => r != null;
  const next = prev
    .map((r) => (fetched.has(r.id) ? fetched.get(r.id) : r))
    .filter(keep);
  const present = new Set(prev.map((r) => r.id));
  for (const [id, r] of fetched) {
    if (!present.has(id) && keep(r)) next.push(r);
  }
  return next;
}

/**
 * Loads every ride the admin rides table shows — requested and scheduled
 * alike — plus the drivers and vehicles needed to assign one, and keeps the
 * rides current from real-time events: changed rows are refetched one by one,
 * and the full list is only reloaded after a (re)connect or a failed refresh.
 */
export const AdminRidesContext = createContext<ReturnType<
  typeof useAdminRidesData
> | null>(null);

export function useAdminRides() {
  const data = useContext(AdminRidesContext);
  if (!data) throw new Error("useAdminRides requires AdminRidesProvider");
  return data;
}

export function useAdminRidesData() {
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [drivers, setDrivers] = useState<DriverEntry[]>([]);
  const [vehicles, setVehicles] = useState<VehicleEntry[]>([]);
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
  const needsReloadRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelayRef = useRef(1000);

  const run = useCallback(async ({ routeIds }: Job) => {
    try {
      // Rows can only be patched into a list that has loaded once.
      if (routeIds && loadedRef.current && !needsReloadRef.current) {
        const ids = [...routeIds];
        const rows = await Promise.all(ids.map(fetchRoute));
        if (!aliveRef.current) return;
        const fetched = new Map(ids.map((id, i) => [id, rows[i]]));
        setRoutes((prev) => mergeRows(prev, fetched));
      } else if (loadedRef.current) {
        const routesData = await fetchJson("/api/routes", "Routes");
        if (!aliveRef.current) return;
        setRoutes(asArray(routesData));
      } else {
        const [routesData, driversData, vehiclesData] = await Promise.all([
          fetchJson("/api/routes", "Routes"),
          fetchJson("/api/users?type=Driver", "Drivers"),
          fetchJson("/api/vehicles", "Vehicles"),
        ]);
        if (!aliveRef.current) return;
        setRoutes(asArray(routesData));
        setDrivers(asArray(driversData));
        setVehicles(asArray(vehiclesData));
        loadedRef.current = true;
      }
      needsReloadRef.current = false;
      setError(null);
      setRefreshError(null);
      return true;
    } catch (e) {
      if (!aliveRef.current) return;
      // A later partial success cannot repair rows missed by this job.
      // Keep requiring a full reload until one succeeds.
      needsReloadRef.current = true;
      const message = e instanceof Error ? e.message : "Failed to load rides.";
      if (loadedRef.current) {
        setRefreshError(
          `Couldn't refresh rides (${message}). Showing the last loaded data.`,
        );
      } else {
        setError(message);
      }
      return false;
    } finally {
      if (aliveRef.current) setLoading(false);
    }
  }, []);

  const enqueue = useCallback(
    function enqueueJob(job: Job) {
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
          while (pendingRef.current && aliveRef.current) {
            const next = pendingRef.current;
            pendingRef.current = null;
            const succeeded = await run(next);
            if (retryTimerRef.current !== null) {
              clearTimeout(retryTimerRef.current);
              retryTimerRef.current = null;
            }
            if (succeeded) {
              retryDelayRef.current = 1000;
            } else if (aliveRef.current) {
              // Retry even if no more events arrive, with capped backoff.
              retryTimerRef.current = setTimeout(() => {
                retryTimerRef.current = null;
                enqueueJob({ routeIds: null });
              }, retryDelayRef.current);
              retryDelayRef.current = Math.min(
                retryDelayRef.current * 2,
                30000,
              );
            }
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
      if (retryTimerRef.current !== null) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [enqueue]);

  useRouteUpdates(({ routeIds }: RouteChanges) => {
    enqueue({ routeIds: routeIds && new Set(routeIds) });
  });

  // Refreshes a single row right after this admin assigns or cancels it,
  // without waiting for the real-time event.
  const refreshRoute = useCallback(
    (routeId: string) => {
      enqueue({ routeIds: new Set([routeId]) });
    },
    [enqueue],
  );

  return {
    routes,
    actionRequiredCount: routes.filter(
      (route) =>
        route.status === RouteStatus.ActionRequiredByAdmin ||
        route.status === RouteStatus.Requested,
    ).length,
    drivers,
    vehicles,
    loading,
    error,
    refreshError,
    refreshRoute,
  };
}
