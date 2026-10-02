"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import tabStyles from "@/components/BogTabs/styles.module.css";
import { RideCard } from "./RideCard";
import styles from "./styles.module.css";
import {
  estDayOfWeek,
  estDayRange,
  estTimeStr,
  formatEstDate,
} from "@/utils/dateEst";
import type { Shift } from "@/utils/types/user";

type Location = {
  _id: string;
  name: string;
};

type EmbeddedVehicle = {
  _id: string;
  vehicleId?: string;
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
  estimatedDropoffTime?: string;
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

function formatShiftTime(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}

function groupRidesByShift(rides: DriverRoute[], shifts: Shift[], day: Date) {
  const remaining = new Set(rides);
  const groups = shifts
    .filter((shift) => shift.dayOfWeek === estDayOfWeek(day))
    .toSorted((a, b) => a.startTime.localeCompare(b.startTime))
    .map((shift) => {
      const shiftRides = rides.filter((route) => {
        const time = estTimeStr(new Date(route.scheduledPickupTime));
        if (
          !remaining.has(route) ||
          time < shift.startTime ||
          time >= shift.endTime
        ) {
          return false;
        }
        remaining.delete(route);
        return true;
      });
      return {
        key: `${shift.startTime}-${shift.endTime}`,
        heading: `${formatShiftTime(shift.startTime)} - ${formatShiftTime(shift.endTime)}`,
        rides: shiftRides,
      };
    });
  if (remaining.size) {
    groups.push({
      key: "other",
      heading: groups.length ? "Other rides" : "",
      rides: [...remaining],
    });
  }
  return groups;
}

export default function DriverRidesView({ userId }: { userId: string }) {
  const [mounted, setMounted] = useState(false);
  const [routes, setRoutes] = useState<DriverRoute[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRoutes, setBusyRoutes] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"today" | "tomorrow">("today");

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

  useEffect(() => {
    // Date-dependent UI must wait until hydration finishes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const fetchRoutes = useCallback(async () => {
    try {
      const range = activeTab === "today" ? todayRange : tomorrowRange;
      const params = new URLSearchParams({
        driver: userId,
        start_time: range[0].toISOString(),
        end_time: range[1].toISOString(),
      });

      const [routesRes, locationsRes, driverRes] = await Promise.all([
        fetch(`/api/routes?${params}`),
        fetch("/api/locations"),
        fetch(`/api/users/${userId}`).catch(() => null),
      ]);
      if (!routesRes.ok) throw new Error("Failed to fetch routes");
      if (!locationsRes.ok) throw new Error("Failed to fetch locations");

      const routesData: DriverRoute[] = await routesRes.json();
      const locationsData: Location[] = await locationsRes.json();
      setRoutes(
        routesData.toSorted((a, b) =>
          a.scheduledPickupTime.localeCompare(b.scheduledPickupTime),
        ),
      );
      setLocations(locationsData);
      // Missing shift information must not hide assigned rides.
      setShifts(driverRes?.ok ? ((await driverRes.json()).shifts ?? []) : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [userId, activeTab, todayRange, tomorrowRange]);

  useEffect(() => {
    if (!mounted) return;
    // Clear the previous day while loading routes for the selected day.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void fetchRoutes();
  }, [mounted, fetchRoutes]);

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
          className={`${tabStyles["bog-tabs-list"]} ${tabStyles["bog-tabs-mobile"]} ${styles.rideTabs}`}
          aria-label="Ride day"
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
    const shiftGroups = groupRidesByShift(routes, shifts, activeDayRange[0]);
    if (shiftGroups.length === 0) {
      return <p className={styles.rideListEmpty}>No rides yet.</p>;
    }
    return shiftGroups.map((shiftGroup) => (
      <div key={shiftGroup.key} className={styles.driverDayGroup}>
        {shiftGroup.heading && (
          <h3 className={styles.driverDayHeading}>{shiftGroup.heading}</h3>
        )}
        <div className={styles.driverDayCards}>
          {shiftGroup.rides.length === 0 && (
            <p className={styles.rideListEmpty}>No rides yet.</p>
          )}
          {shiftGroup.rides.map((route) => (
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
