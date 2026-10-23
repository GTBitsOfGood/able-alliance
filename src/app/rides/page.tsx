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
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";
import {
  estDateKey,
  estDayRange,
  estWeekRange,
  formatEstDate,
  isEstToday,
} from "@/utils/dateEst";

import type { RouteResponse as Route } from "@/utils/types/api";

function formatWeekRangeHeader(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `Week of ${formatEstDate(start, opts)} - ${formatEstDate(end, opts)}`;
}

function formatDayGroupHeader(iso: string): string {
  const date = new Date(iso);
  const monthAndDay = formatEstDate(date, { month: "long", day: "numeric" });
  if (isEstToday(date)) return `Today, ${monthAndDay}`;
  if (estDateKey(date) === estDateKey(estDayRange(1)[0])) {
    return `Tomorrow, ${monthAndDay}`;
  }
  return formatEstDate(date, {
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  useEffect(() => {
    // Date-dependent UI must wait until hydration finishes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const fetchRides = useCallback(async () => {
    if (!session?.user?.userId) return;
    try {
      const routesRes = await fetch(
        `/api/routes?student=${session.user.userId}`,
      );
      if (!routesRes.ok) throw new Error("Failed to fetch routes");
      const routesData = await routesRes.json();
      setRoutes(
        routesData.filter((r: Route) => r.status !== "CancelledByStudent"),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!mounted) return;
    // This effect starts an asynchronous API request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRides();
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
      setRoutes((prev) => prev.filter((r) => r.id !== routeId));
      setCancelTargetId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancellation failed.");
    } finally {
      setCancellingId(null);
    }
  }, []);

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
            <div className={styles.dateGroupCards}>
              {routesByDate[dateKey].map((route) => (
                <RideCard
                  key={route.id}
                  route={route}
                  href={`/rides/${route.id}`}
                  onCancel={(id) => setCancelTargetId(id)}
                  cancelling={cancellingId === route.id}
                />
              ))}
            </div>
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
    <Link href="/rides/new" className={styles.requestRideButtonLink}>
      <BogButton
        variant="primary"
        size="medium"
        className={styles.requestRideButton}
        iconProps={{
          position: "left",
          iconProps: { name: "plus", size: 20 },
        }}
      >
        Request new ride
      </BogButton>
    </Link>
  );

  return (
    <div className={styles.ridesPage}>
      <ConfirmActionModal
        open={cancelTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTargetId(null);
        }}
        onConfirm={() => {
          if (cancelTargetId) void handleCancel(cancelTargetId);
        }}
        variant="destructive"
        title="Cancel Ride?"
        description="Are you sure you want to cancel this ride?"
        confirmLabel="Cancel ride"
        confirmingLabel="Cancelling…"
        cancelLabel="Nevermind"
        confirming={cancelTargetId !== null && cancellingId === cancelTargetId}
      />
      <main className={styles.main}>
        <div className={styles.mainHeader}>
          <h1 className={styles.pageTitle}>Your Rides</h1>
        </div>

        {error && (
          <p className={styles.errorMessage} role="status">
            {error}
          </p>
        )}

        <Tabs.Root defaultValue="this-week" className={styles.tabsLayout}>
          <div className={styles.tabsRow}>
            <Tabs.List
              className={`${tabStyles["bog-tabs-list"]} ${tabStyles["bog-tabs-mobile"]} ${styles.rideTabs}`}
              aria-label="Ride week"
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
