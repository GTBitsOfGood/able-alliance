"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import tabStyles from "@/components/BogTabs/styles.module.css";
import { RideCard } from "./RideCard";
import styles from "./styles.module.css";

type Location = {
  _id: string;
  name: string;
};

type EmbeddedVehicle = {
  _id: string;
  name: string;
  licensePlate: string;
  description?: string;
  accessibility: "None" | "Wheelchair";
  seatCount: number;
};

type DriverRoute = {
  _id: string;
  pickupLocation: string;
  dropoffLocation: string;
  scheduledPickupTime: string;
  status: string;
  vehicle?: EmbeddedVehicle;
  driver?: { _id: string };
};

function getWeekRange(offset: 0 | 1): [Date, Date] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek + offset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function groupByVehicle(
  routes: DriverRoute[],
): Map<string, { vehicle: EmbeddedVehicle; rides: DriverRoute[] }> {
  const map = new Map<
    string,
    { vehicle: EmbeddedVehicle; rides: DriverRoute[] }
  >();
  for (const route of routes) {
    if (!route.vehicle) continue;
    const key = route.vehicle._id;
    if (!map.has(key)) {
      map.set(key, { vehicle: route.vehicle, rides: [] });
    }
    map.get(key)!.rides.push(route);
  }
  // Sort rides within each vehicle by scheduled time
  for (const group of map.values()) {
    group.rides.sort(
      (a, b) =>
        new Date(a.scheduledPickupTime).getTime() -
        new Date(b.scheduledPickupTime).getTime(),
    );
  }
  return map;
}

function formatAssignedVehicleTitle() {
  const todayLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return `Assigned Vehicle Today, ${todayLabel}`;
}

function getAccessibilityLabel(
  accessibility: EmbeddedVehicle["accessibility"],
) {
  if (accessibility === "Wheelchair") {
    return "Wheel-chair accessible";
  }
  return "None";
}

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatWeekHeading(range: [Date, Date]) {
  const startLabel = range[0].toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = range[1].toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `Week of ${startLabel} - ${endLabel}`;
}

function formatDayHeading(date: Date) {
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  const monthAndDay = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  if (isToday) {
    return `Today, ${monthAndDay}`;
  }

  const weekDay = date.toLocaleDateString("en-US", { weekday: "long" });
  return `${weekDay}, ${monthAndDay}`;
}

function groupRidesByDay(rides: DriverRoute[]) {
  const dayMap = new Map<string, { date: Date; rides: DriverRoute[] }>();

  for (const route of rides) {
    const routeDate = new Date(route.scheduledPickupTime);
    const dayDate = new Date(
      routeDate.getFullYear(),
      routeDate.getMonth(),
      routeDate.getDate(),
    );
    const key = getLocalDateKey(dayDate);

    if (!dayMap.has(key)) {
      dayMap.set(key, { date: dayDate, rides: [] });
    }
    dayMap.get(key)!.rides.push(route);
  }

  return Array.from(dayMap.entries())
    .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
    .map(([key, group]) => ({
      key,
      date: group.date,
      rides: group.rides.sort(
        (a, b) =>
          new Date(a.scheduledPickupTime).getTime() -
          new Date(b.scheduledPickupTime).getTime(),
      ),
    }));
}

export default function DriverRidesView({ userId }: { userId: string }) {
  const [mounted, setMounted] = useState(false);
  const [routes, setRoutes] = useState<DriverRoute[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRoutes, setBusyRoutes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"this-week" | "next-week">(
    "this-week",
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const thisWeekRange = useMemo(
    () => (mounted ? getWeekRange(0) : [new Date(0), new Date(0)]),
    [mounted],
  );
  const nextWeekRange = useMemo(
    () => (mounted ? getWeekRange(1) : [new Date(0), new Date(0)]),
    [mounted],
  );

  const fetchRoutes = useCallback(async () => {
    try {
      const range = activeTab === "this-week" ? thisWeekRange : nextWeekRange;
      const params = new URLSearchParams({
        driver: userId,
        start_time: range[0].toISOString(),
        end_time: range[1].toISOString(),
      });

      const [routesRes, locationsRes] = await Promise.all([
        fetch(`/api/routes?${params}`),
        fetch("/api/locations"),
      ]);
      if (!routesRes.ok) throw new Error("Failed to fetch routes");
      if (!locationsRes.ok) throw new Error("Failed to fetch locations");

      const routesData: DriverRoute[] = await routesRes.json();
      const locationsData: Location[] = await locationsRes.json();
      setRoutes(routesData);
      setLocations(locationsData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab, thisWeekRange, nextWeekRange]);

  useEffect(() => {
    setLoading(true);
    fetchRoutes();
  }, [fetchRoutes]);

  const locationIdToName = useMemo(
    () =>
      locations.reduce(
        (acc, loc) => {
          acc[loc._id] = loc.name;
          return acc;
        },
        {} as Record<string, string>,
      ),
    [locations],
  );

  const vehicleGroups = useMemo(() => groupByVehicle(routes), [routes]);
  const activeWeekRange = useMemo(
    () => (activeTab === "this-week" ? thisWeekRange : nextWeekRange),
    [activeTab, thisWeekRange, nextWeekRange],
  );
  const weekHeading = useMemo(
    () => (mounted ? formatWeekHeading(activeWeekRange) : "—"),
    [mounted, activeWeekRange],
  );
  const assignedVehicleTitle = useMemo(
    () => (mounted ? formatAssignedVehicleTitle() : "Assigned Vehicle"),
    [mounted],
  );

  function renderWeekToggle() {
    return (
      <div className={styles.driverWeekToggleRow}>
        <Tabs.List
          className={`${tabStyles["bog-tabs-list"]} ${tabStyles["bog-tabs-mobile"]}`}
        >
          <Tabs.Trigger
            value="this-week"
            className={`${tabStyles["bog-tabs-trigger"]} ${tabStyles["bog-tabs-label-wrapper"]}`}
          >
            <div className={tabStyles["bog-tabs-label"]}>This week</div>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="next-week"
            className={`${tabStyles["bog-tabs-trigger"]} ${tabStyles["bog-tabs-label-wrapper"]}`}
          >
            <div className={tabStyles["bog-tabs-label"]}>Next week</div>
          </Tabs.Trigger>
        </Tabs.List>
      </div>
    );
  }

  async function handleCancel(routeId: string) {
    setBusyRoutes((prev) => new Set(prev).add(routeId));
    try {
      const res = await fetch("/api/routes/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to cancel ride");
        return;
      }
      await fetchRoutes();
    } catch {
      setError("Failed to cancel ride");
    } finally {
      setBusyRoutes((prev) => {
        const next = new Set(prev);
        next.delete(routeId);
        return next;
      });
    }
  }

  async function handleStart(routeId: string) {
    setBusyRoutes((prev) => new Set(prev).add(routeId));
    try {
      const res = await fetch("/api/routes/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to start ride");
        return;
      }
      await fetchRoutes();
    } catch {
      setError("Failed to start ride");
    } finally {
      setBusyRoutes((prev) => {
        const next = new Set(prev);
        next.delete(routeId);
        return next;
      });
    }
  }

  function renderVehicleGroups() {
    if (vehicleGroups.size === 0 && !loading) {
      return (
        <>
          {renderWeekToggle()}
          <h2 className={styles.driverWeekHeading}>{weekHeading}</h2>
          <p className={styles.rideListEmpty}>No rides yet.</p>
        </>
      );
    }

    return Array.from(vehicleGroups.values()).map(
      ({ vehicle, rides }, index) => (
        <div key={vehicle._id} className={styles.vehicleSection}>
          <div className={styles.vehicleCard}>
            <div className={styles.vehicleCardContent}>
              <h2 className={styles.vehicleHeader}>{assignedVehicleTitle}</h2>

              <div className={styles.vehicleInfoRow}>
                <div className={styles.vehicleInfoItem}>
                  <span className={styles.vehicleInfoLabel}>License plate</span>
                  <span className={styles.vehiclePlateValue}>
                    {vehicle.licensePlate}
                  </span>
                </div>
                <div className={styles.vehicleInfoItem}>
                  <span className={styles.vehicleInfoLabel}>
                    Make &amp; Model
                  </span>
                  <span className={styles.vehicleInfoValue}>
                    {vehicle.name}
                  </span>
                </div>
                <div className={styles.vehicleInfoItem}>
                  <span className={styles.vehicleInfoLabel}>Color</span>
                  <span className={styles.vehicleInfoValue}>
                    {vehicle.description || "Unknown"}
                  </span>
                </div>
              </div>

              <div className={styles.vehicleAccessibilitySection}>
                <span className={styles.vehicleInfoLabel}>
                  Disability features supported
                </span>
                <span className={styles.vehicleAccessibilityValue}>
                  {getAccessibilityLabel(vehicle.accessibility)}
                </span>
              </div>
            </div>

            <div className={styles.vehicleImageSlot} aria-hidden="true">
              <span className={styles.vehicleImageText}>Vehicle image</span>
            </div>
          </div>

          {index === 0 && renderWeekToggle()}
          {index === 0 && (
            <h2 className={styles.driverWeekHeading}>{weekHeading}</h2>
          )}

          <div className={styles.vehicleRides}>
            {groupRidesByDay(rides).map((dayGroup) => (
              <div key={dayGroup.key} className={styles.driverDayGroup}>
                <h3 className={styles.driverDayHeading}>
                  {mounted ? formatDayHeading(dayGroup.date) : "—"}
                </h3>
                <div className={styles.driverDayCards}>
                  {dayGroup.rides.map((route) => {
                    const isBusy = busyRoutes.has(route._id);
                    const canAct =
                      route.status === "Scheduled" ||
                      route.status === "En-route";
                    return (
                      <RideCard
                        key={route._id}
                        route={{
                          ...route,
                          driver: route.driver?._id,
                        }}
                        locationIdToName={locationIdToName}
                        actions={
                          canAct ? (
                            <>
                              <button
                                className={styles.cancelRideButton}
                                disabled={isBusy}
                                onClick={() => handleCancel(route._id)}
                              >
                                Cancel ride
                              </button>
                              {route.status === "Scheduled" && (
                                <button
                                  type="button"
                                  className={styles.startRideButton}
                                  disabled={isBusy}
                                  onClick={() => handleStart(route._id)}
                                >
                                  Start ride
                                </button>
                              )}
                            </>
                          ) : undefined
                        }
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    );
  }

  return (
    <main className={styles.driverMain}>
      <div className={styles.mainHeader}>
        <h1 className={styles.pageTitle}>Your Rides</h1>
      </div>

      {error && (
        <p className={styles.errorMessage} role="status">
          {error}
        </p>
      )}

      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "this-week" | "next-week")}
        className={styles.tabsLayout}
      >
        {loading ? (
          <p className={styles.rideListLoading}>Loading…</p>
        ) : (
          renderVehicleGroups()
        )}
      </Tabs.Root>
    </main>
  );
}
