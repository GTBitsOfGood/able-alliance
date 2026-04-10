"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import tabStyles from "@/components/BogTabs/styles.module.css";
import { RideCard } from "./RideCard";
import styles from "./styles.module.css";
import {
  estDateKey,
  estDayRange,
  formatEstDate,
  isEstToday,
} from "@/utils/dateEst";

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
  student?: { firstName: string; lastName: string };
};

function formatDayRangeHeading(range: [Date, Date]) {
  return formatEstDate(range[0], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatDayHeading(date: Date) {
  const monthAndDay = formatEstDate(date, { month: "long", day: "numeric" });
  if (isEstToday(date)) return `Today, ${monthAndDay}`;
  return `${formatEstDate(date, { weekday: "long" })}, ${monthAndDay}`;
}

function groupRidesByDay(rides: DriverRoute[]) {
  const dayMap = new Map<string, { date: Date; rides: DriverRoute[] }>();

  for (const route of rides) {
    const routeDate = new Date(route.scheduledPickupTime);
    const key = estDateKey(routeDate);

    if (!dayMap.has(key)) {
      dayMap.set(key, { date: routeDate, rides: [] });
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
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow">("today");

  useEffect(() => {
    setMounted(true);
  }, []);

  const todayRange = useMemo(
    () =>
      mounted ? estDayRange(0) : ([new Date(0), new Date(0)] as [Date, Date]),
    [mounted],
  );
  const tomorrowRange = useMemo(
    () =>
      mounted ? estDayRange(1) : ([new Date(0), new Date(0)] as [Date, Date]),
    [mounted],
  );

  const fetchRoutes = useCallback(async () => {
    try {
      const range = activeTab === "today" ? todayRange : tomorrowRange;
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
  }, [userId, activeTab, todayRange, tomorrowRange]);

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

  const activeDayRange = useMemo(
    () => (activeTab === "today" ? todayRange : tomorrowRange),
    [activeTab, todayRange, tomorrowRange],
  );
  const dayHeading = useMemo(
    () => (mounted ? formatDayRangeHeading(activeDayRange) : "—"),
    [mounted, activeDayRange],
  );

  function renderDayToggle() {
    return (
      <div className={styles.driverWeekToggleRow}>
        <Tabs.List
          className={`${tabStyles["bog-tabs-list"]} ${tabStyles["bog-tabs-mobile"]}`}
        >
          <Tabs.Trigger
            value="today"
            className={`${tabStyles["bog-tabs-trigger"]} ${tabStyles["bog-tabs-label-wrapper"]}`}
          >
            <div className={tabStyles["bog-tabs-label"]}>Today</div>
          </Tabs.Trigger>
          <Tabs.Trigger
            value="tomorrow"
            className={`${tabStyles["bog-tabs-trigger"]} ${tabStyles["bog-tabs-label-wrapper"]}`}
          >
            <div className={tabStyles["bog-tabs-label"]}>Tomorrow</div>
          </Tabs.Trigger>
        </Tabs.List>
      </div>
    );
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

  function renderRides() {
    const dayGroups = groupRidesByDay(routes);
    if (dayGroups.length === 0) {
      return <p className={styles.rideListEmpty}>No rides yet.</p>;
    }
    return dayGroups.map((dayGroup) => (
      <div key={dayGroup.key} className={styles.driverDayGroup}>
        <h3 className={styles.driverDayHeading}>
          {mounted ? formatDayHeading(dayGroup.date) : "—"}
        </h3>
        <div className={styles.driverDayCards}>
          {dayGroup.rides.map((route) => (
            <RideCard
              key={route._id}
              route={{
                ...route,
                driver: route.driver?._id,
              }}
              locationIdToName={locationIdToName}
              isDriverCard
              href={`/rides/${route._id}`}
              onStart={() => handleStart(route._id)}
              startBusy={busyRoutes.has(route._id)}
            />
          ))}
        </div>
      </div>
    ));
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
        onValueChange={(v) => setActiveTab(v as "today" | "tomorrow")}
        className={styles.tabsLayout}
      >
        {renderDayToggle()}
        <h2 className={styles.driverWeekHeading}>{dayHeading}</h2>
        {loading ? (
          <p className={styles.rideListLoading}>Loading…</p>
        ) : (
          renderRides()
        )}
      </Tabs.Root>
    </main>
  );
}
