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
import { CancelRideModal } from "./CancelRideModal";
import { estDateKey, estWeekRange, formatEstDate } from "@/utils/dateEst";

export type Location = {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
};
export type RouteUser = {
  _id: string;
  firstName: string;
  lastName: string;
};
export type Route = {
  _id: string;
  pickupLocation: string;
  dropoffLocation: string;
  student: string | RouteUser;
  driver?: string | RouteUser;
  vehicle?: string;
  scheduledPickupTime: string;
  pickupWindowEnd?: string;
  estimatedDropoffTime?: string;
  status: string;
};

function formatWeekRangeHeader(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `Week of ${formatEstDate(start, opts)} - ${formatEstDate(end, opts)}`;
}

function formatDayGroupHeader(iso: string): string {
  return formatEstDate(new Date(iso), {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getDateKey(iso: string): string {
  return estDateKey(new Date(iso));
}

function getWeekRange(offset: 0 | 1): [Date, Date] {
  return estWeekRange(offset);
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
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

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
    if (!mounted) return;
    fetchRides();
  }, [mounted, fetchRides]);

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
      setCancelTargetId(null);
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

  const thisWeekRange = React.useMemo(
    () =>
      mounted ? getWeekRange(0) : ([new Date(0), new Date(0)] as [Date, Date]),
    [mounted],
  );
  const nextWeekRange = React.useMemo(
    () =>
      mounted ? getWeekRange(1) : ([new Date(0), new Date(0)] as [Date, Date]),
    [mounted],
  );

  const routesByDateThisWeek = React.useMemo(() => {
    const filtered = routes.filter((r) =>
      isInRange(r.scheduledPickupTime, thisWeekRange),
    );
    return groupRoutesByDate(filtered);
  }, [routes, thisWeekRange]);

  const routesByDateNextWeek = React.useMemo(() => {
    const filtered = routes.filter((r) =>
      isInRange(r.scheduledPickupTime, nextWeekRange),
    );
    return groupRoutesByDate(filtered);
  }, [routes, nextWeekRange]);

  const todayKey = React.useMemo(
    () => (mounted ? estDateKey(new Date()) : ""),
    [mounted],
  );

  const dateKeysThisWeek = Object.keys(routesByDateThisWeek)
    .sort()
    .filter((k) => k >= todayKey);
  const dateKeysNextWeek = Object.keys(routesByDateNextWeek).sort();

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
    requestButton: React.ReactNode,
  ) {
    const isEmpty = dateKeys.length === 0;
    return (
      <div className={styles.rideList}>
        {isEmpty && !loading && (
          <>
            <div className={`${styles.dayHeaderRow} ${styles.dayHeaderRowEnd}`}>
              {requestButton}
            </div>
            <p className={styles.rideListEmpty}>No rides yet.</p>
          </>
        )}
        {dateKeys.map((dateKey, index) => (
          <div key={dateKey} className={styles.dateGroup}>
            <div className={styles.dayHeaderRow}>
              <h4 className={styles.dayGroupHeading}>
                {formatDayGroupHeader(
                  routesByDate[dateKey][0].scheduledPickupTime,
                )}
              </h4>
              {index === 0 ? requestButton : null}
            </div>
            {routesByDate[dateKey].map((route) => (
              <RideCard
                key={route._id}
                route={route}
                locationIdToName={locationIdToName}
                href={`/rides/${route._id}`}
                onCancel={(id) => setCancelTargetId(id)}
                cancelling={cancellingId === route._id}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const thisWeekHeader = formatWeekRangeHeader(
    thisWeekRange[0],
    thisWeekRange[1],
  );
  const nextWeekHeader = formatWeekRangeHeader(
    nextWeekRange[0],
    nextWeekRange[1],
  );

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
      <CancelRideModal
        open={cancelTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTargetId(null);
        }}
        onConfirmCancel={() => {
          if (cancelTargetId) void handleCancel(cancelTargetId);
        }}
        confirming={cancelTargetId !== null && cancellingId === cancelTargetId}
      />
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

        <Tabs.Root defaultValue="this-week" className={styles.tabsLayout}>
          <div className={styles.tabsRow}>
            <Tabs.List
              className={`${tabStyles["bog-tabs-list"]} ${tabStyles["bog-tabs-mobile"]}`}
            >
              <Tabs.Trigger
                value="this-week"
                className={`${tabStyles["bog-tabs-trigger"]} ${tabStyles["bog-tabs-label-wrapper"]}`}
              >
                <div className={tabStyles["bog-tabs-label"]}>This Week</div>
              </Tabs.Trigger>
              <Tabs.Trigger
                value="next-week"
                className={`${tabStyles["bog-tabs-trigger"]} ${tabStyles["bog-tabs-label-wrapper"]}`}
              >
                <div className={tabStyles["bog-tabs-label"]}>Next Week</div>
              </Tabs.Trigger>
            </Tabs.List>
          </div>
          <Tabs.Content value="this-week" className={styles.tabContentPanel}>
            <div className={styles.tabContentHeader}>
              <h2 className={styles.dateHeader}>{thisWeekHeader}</h2>
            </div>
            {loading ? (
              <p className={styles.rideListLoading}>Loading…</p>
            ) : (
              renderRideList(
                routesByDateThisWeek,
                dateKeysThisWeek,
                requestRideButton,
              )
            )}
          </Tabs.Content>
          <Tabs.Content value="next-week" className={styles.tabContentPanel}>
            <div className={styles.tabContentHeader}>
              <h2 className={styles.dateHeader}>{nextWeekHeader}</h2>
            </div>
            {loading ? (
              <p className={styles.rideListLoading}>Loading…</p>
            ) : (
              renderRideList(
                routesByDateNextWeek,
                dateKeysNextWeek,
                requestRideButton,
              )
            )}
          </Tabs.Content>
        </Tabs.Root>
      </main>
    </div>
  );
}
