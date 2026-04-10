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
  student?: { firstName: string; lastName: string };
};

function getDayRange(offset: 0 | 1): [Date, Date] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() + offset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDayRangeHeading(range: [Date, Date]) {
  return range[0].toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
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
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow">("today");

  useEffect(() => {
    setMounted(true);
  }, []);

  const todayRange = useMemo(
    () =>
      mounted ? getDayRange(0) : ([new Date(0), new Date(0)] as [Date, Date]),
    [mounted],
  );
  const tomorrowRange = useMemo(
    () =>
      mounted ? getDayRange(1) : ([new Date(0), new Date(0)] as [Date, Date]),
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
