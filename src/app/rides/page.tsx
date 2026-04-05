"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";
import BogButton from "@/components/BogButton/BogButton";
import tabStyles from "@/components/BogTabs/styles.module.css";
import { RideCard } from "./RideCard";
import DriverRidesView from "./DriverRidesView";
import styles from "./styles.module.css";

type Location = {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
};
type RouteUser = {
  _id: string;
  firstName: string;
  lastName: string;
};
type Route = {
  _id: string;
  pickupLocation: string;
  dropoffLocation: string;
  student: string | RouteUser;
  driver?: string | RouteUser;
  vehicle?: string;
  scheduledPickupTime: string;
  status: string;
};

function formatDateHeader(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isToday =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
  if (isToday) {
    return `Today, ${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  } else {
    return `Tomorrow, ${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  }
}

function getDateKey(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

function getDayRange(offset: 0 | 1): [Date, Date] {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() + offset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return [start, end];
}

function isInRange(iso: string, [start, end]: [Date, Date]): boolean {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function groupRoutesByDate(routes: Route[]): Record<string, Route[]> {
  const map: Record<string, Route[]> = {};
  for (const route of routes) {
    const key = getDateKey(route.scheduledPickupTime);
    if (!map[key]) map[key] = [];
    map[key].push(route);
  }
  for (const arr of Object.values(map)) {
    arr.sort(
      (a, b) =>
        new Date(a.scheduledPickupTime).getTime() -
        new Date(b.scheduledPickupTime).getTime(),
    );
  }
  return map;
}

export default function RidesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [mounted, setMounted] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchRides = useCallback(async () => {
    if (!session?.user?.userId) return;
    try {
      const [routesRes, locationsRes] = await Promise.all([
        fetch(`/api/routes?student=${session.user.userId}`),
        fetch("/api/locations"),
      ]);
      if (!routesRes.ok) throw new Error("Failed to fetch routes");
      if (!locationsRes.ok) throw new Error("Failed to fetch locations");
      const routesData = await routesRes.json();
      const locationsData = await locationsRes.json();
      setRoutes(
        routesData.filter((r: Route) => r.status !== "Cancelled by Student"),
      );
      setLocations(locationsData);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  const handleCancel = useCallback(async (routeId: string) => {
    setCancellingId(routeId);
    try {
      const res = await fetch("/api/routes/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      setRoutes((prev) => prev.filter((r) => r._id !== routeId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancellation failed.");
    } finally {
      setCancellingId(null);
    }
  }, []);

  const locationIdToName: Record<string, string> = locations.reduce(
    (acc, loc) => {
      acc[loc._id] = loc.name;
      return acc;
    },
    {} as Record<string, string>,
  );

  const todayRange = React.useMemo(
    () =>
      mounted ? getDayRange(0) : ([new Date(0), new Date(0)] as [Date, Date]),
    [mounted],
  );
  const tomorrowRange = React.useMemo(
    () =>
      mounted ? getDayRange(1) : ([new Date(0), new Date(0)] as [Date, Date]),
    [mounted],
  );

  const routesByDateToday = React.useMemo(() => {
    const filtered = routes.filter((r) =>
      isInRange(r.scheduledPickupTime, todayRange),
    );
    return groupRoutesByDate(filtered);
  }, [routes, todayRange]);

  const routesByDateTomorrow = React.useMemo(() => {
    const filtered = routes.filter((r) =>
      isInRange(r.scheduledPickupTime, tomorrowRange),
    );
    return groupRoutesByDate(filtered);
  }, [routes, tomorrowRange]);

  const dateKeysToday = Object.keys(routesByDateToday).sort();
  const dateKeysTomorrow = Object.keys(routesByDateTomorrow).sort();

  if (sessionStatus === "loading") {
    return (
      <div className={styles.ridesPage}>
        <main className={styles.main}>
          <p className={styles.rideListLoading}>Loading…</p>
        </main>
      </div>
    );
  }

  if (session?.user?.type === "Driver") {
    return (
      <div className={styles.ridesPage}>
        <DriverRidesView userId={session.user.userId} />
      </div>
    );
  }

  function renderRideList(
    routesByDate: Record<string, Route[]>,
    dateKeys: string[],
  ) {
    const isEmpty = dateKeys.length === 0;
    return (
      <div className={styles.rideList}>
        {isEmpty && !loading && (
          <p className={styles.rideListEmpty}>No rides yet.</p>
        )}
        {dateKeys.map((dateKey) => (
          <div key={dateKey} className={styles.dateGroup}>
            {routesByDate[dateKey].map((route) => (
              <RideCard
                key={route._id}
                route={route}
                locationIdToName={locationIdToName}
                href={`/rides/${route._id}`}
                onCancel={handleCancel}
                cancelling={cancellingId === route._id}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const todayDateHeader =
    dateKeysToday.length > 0
      ? formatDateHeader(
          routesByDateToday[dateKeysToday[0]][0].scheduledPickupTime,
        )
      : formatDateHeader(new Date().toISOString());
  const tomorrowDateHeader =
    dateKeysTomorrow.length > 0
      ? formatDateHeader(
          routesByDateTomorrow[dateKeysTomorrow[0]][0].scheduledPickupTime,
        )
      : (() => {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          return formatDateHeader(d.toISOString());
        })();

  const requestRideButton = (
    <Link href="/rides/new">
      <BogButton
        variant="primary"
        size="medium"
        className={styles.requestRideButton}
        iconProps={{
          position: "left",
          iconProps: { name: "plus", size: 18 },
        }}
      >
        Request new ride
      </BogButton>
    </Link>
  );

  return (
    <div className={styles.ridesPage}>
      <main className={styles.main}>
        <div className={styles.mainHeader}>
          <h1 className={styles.pageTitle}>
            {session?.user?.firstName
              ? `${session.user.firstName}'s Rides`
              : "Your Rides"}
          </h1>
        </div>

        {error && (
          <p className={styles.errorMessage} role="status">
            {error}
          </p>
        )}

        <Tabs.Root defaultValue="today" className={styles.tabsLayout}>
          <div className={styles.tabsRow}>
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
          <Tabs.Content value="today" className={styles.tabContentPanel}>
            <div className={styles.tabContentHeader}>
              <h2 className={styles.dateHeader}>{todayDateHeader}</h2>
              {requestRideButton}
            </div>
            {loading ? (
              <p className={styles.rideListLoading}>Loading…</p>
            ) : (
              renderRideList(routesByDateToday, dateKeysToday)
            )}
          </Tabs.Content>
          <Tabs.Content value="tomorrow" className={styles.tabContentPanel}>
            <div className={styles.tabContentHeader}>
              <h2 className={styles.dateHeader}>{tomorrowDateHeader}</h2>
              {requestRideButton}
            </div>
            {loading ? (
              <p className={styles.rideListLoading}>Loading…</p>
            ) : (
              renderRideList(routesByDateTomorrow, dateKeysTomorrow)
            )}
          </Tabs.Content>
        </Tabs.Root>
      </main>
    </div>
  );
}
