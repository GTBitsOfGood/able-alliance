"use client";

import { RouteStatus } from "@db/generated/enums";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import * as Tabs from "@radix-ui/react-tabs";
import Link from "next/link";
import BogButton from "@/components/BogButton/BogButton";
import BogIcon from "@/components/BogIcon/BogIcon";
import tabStyles from "@/components/BogTabs/styles.module.css";
import { RideCard } from "./RideCard";
import DriverRidesView from "./DriverRidesView";
import styles from "./styles.module.css";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";
import CancelScopeOptions, {
  type CancelScope,
} from "@/components/CancelScopeOptions/CancelScopeOptions";
import DelayRideModal from "@/components/DelayRideModal/DelayRideModal";
import { useRouteUpdates } from "@/hooks/useRouteUpdates";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import {
  estDateKey,
  estDayRange,
  estWeekRange,
  formatEstDate,
  isEstToday,
} from "@/utils/dateEst";

import type { RouteResponse as Route } from "@/types/api";

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
  const [cancelScope, setCancelScope] = useState<CancelScope>("single");
  const cancelTarget = routes.find((route) => route.id === cancelTargetId);
  const [delayTargetId, setDelayTargetId] = useState<string | null>(null);
  const [delaying, setDelaying] = useState(false);
  const delayPending = useRef(false);
  const [delayError, setDelayError] = useState<string | null>(null);
  const delayTarget = routes.find((route) => route.id === delayTargetId);
  const [requestMenuOpen, setRequestMenuOpen] = useState(false);

  useEffect(() => {
    // Date-dependent UI must wait until hydration finishes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const beginRequest = useLatestRequest();

  const fetchRides = useCallback(async () => {
    if (!session?.user?.userId) return;
    const isLatest = beginRequest();
    try {
      const routesRes = await fetch(
        `/api/routes?student=${session.user.userId}`,
      );
      if (!routesRes.ok) throw new Error("Failed to fetch routes");
      const routesData = await routesRes.json();
      if (!isLatest()) return;
      setRoutes(
        routesData.filter(
          (r: Route) => r.status !== RouteStatus.CancelledByStudent,
        ),
      );
      setError(null);
    } catch (e) {
      if (!isLatest()) return;
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [session, beginRequest]);

  useEffect(() => {
    if (!mounted) return;
    // This effect starts an asynchronous API request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRides();
  }, [mounted, fetchRides]);

  // Drivers get their own subscription inside DriverRidesView.
  useRouteUpdates(() => {
    if (mounted && session?.user?.activeType === "Student") void fetchRides();
  });

  const handleCancel = useCallback(
    async (routeId: string, scope: CancelScope) => {
      setCancellingId(routeId);
      try {
        const res = await fetch("/api/routes/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ routeId, scope }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? res.statusText);
        }
        setCancelTargetId(null);
        if (scope === "series") {
          // Later rides in the series were cancelled too.
          void fetchRides();
        } else {
          beginRequest();
          setRoutes((prev) => prev.filter((r) => r.id !== routeId));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Cancellation failed.");
      } finally {
        setCancellingId(null);
      }
    },
    [beginRequest, fetchRides],
  );

  const openCancel = useCallback((routeId: string) => {
    setCancelScope("single");
    setCancelTargetId(routeId);
  }, []);

  const handleDelay = async (minutes: number) => {
    if (!delayTargetId || delayPending.current) return;
    delayPending.current = true;
    setDelaying(true);
    setDelayError(null);
    try {
      const res = await fetch("/api/routes/delay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId: delayTargetId, delayMinutes: minutes }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      const updated: Route = await res.json();
      beginRequest();
      setRoutes((prev) =>
        prev.map((route) => (route.id === updated.id ? updated : route)),
      );
      setDelayTargetId(null);
    } catch (e) {
      setDelayError(e instanceof Error ? e.message : "Failed to delay ride.");
    } finally {
      delayPending.current = false;
      setDelaying(false);
    }
  };

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

  const actionRequiredRoutes = routes.filter(
    (route) => route.status === RouteStatus.ActionRequiredByStudent,
  );
  const actionRequiredByDate = groupRoutesByDate(actionRequiredRoutes);
  const actionRequiredDateKeys = Object.keys(actionRequiredByDate).sort();

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

  if (session?.user?.activeType === "Driver") {
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
                  onCancel={openCancel}
                  cancelling={cancellingId === route.id}
                  onDelay={(id) => {
                    setDelayError(null);
                    setDelayTargetId(id);
                  }}
                  delaying={delaying && delayTargetId === route.id}
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
    <div className={styles.requestRideButtonGroup}>
      <Link href="/rides/new" className={styles.requestRideButtonLink}>
        <BogButton className={styles.requestRideButton}>
          <span className={styles.requestRideButtonContent}>
            <BogIcon name="plus" size={20} color="currentColor" />
            Request new ride
          </span>
        </BogButton>
      </Link>
      <div className={styles.requestRideMenuWrap}>
        <BogButton
          className={styles.requestRideMenuButton}
          aria-label="Request multiple rides"
          aria-expanded={requestMenuOpen}
          aria-haspopup="menu"
          onClick={() => setRequestMenuOpen((open) => !open)}
        >
          <BogIcon name="chevron-down" size={20} color="currentColor" />
        </BogButton>
        {requestMenuOpen && (
          <Link
            href="/rides/new/batch"
            className={styles.requestRidePopover}
            role="menuitem"
            onClick={() => setRequestMenuOpen(false)}
          >
            Request multiple rides
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.ridesPage}>
      {delayTarget && (
        <DelayRideModal
          open
          onOpenChange={(open) => {
            if (!open) setDelayTargetId(null);
          }}
          onConfirm={handleDelay}
          currentDelayMinutes={delayTarget.delayMinutes ?? 0}
          confirming={delaying}
          delayActionError={delayError ?? undefined}
          onCancelRide={() => {
            openCancel(delayTarget.id);
            setDelayTargetId(null);
          }}
        />
      )}
      <ConfirmActionModal
        open={cancelTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTargetId(null);
        }}
        onConfirm={() => {
          if (cancelTargetId) void handleCancel(cancelTargetId, cancelScope);
        }}
        variant="destructive"
        title="Cancel Ride?"
        description={
          cancelTarget?.seriesId
            ? "This is a recurring ride. Which rides do you want to cancel?"
            : "Are you sure you want to cancel this ride?"
        }
        confirmLabel={cancelScope === "series" ? "Cancel rides" : "Cancel ride"}
        confirmingLabel="Cancelling…"
        cancelLabel="Nevermind"
        confirming={cancelTargetId !== null && cancellingId === cancelTargetId}
      >
        {cancelTarget?.seriesId && (
          <CancelScopeOptions
            value={cancelScope}
            onChange={setCancelScope}
            disabled={cancellingId !== null}
          />
        )}
      </ConfirmActionModal>
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
              className={`${tabStyles["bog-tabs-list"]} ${tabStyles["bog-tabs-mobile"]} ${styles.rideTabs} ${styles.studentTabs}`}
              aria-label="Ride views"
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
              <Tabs.Trigger
                value="action-required"
                className={`${styles.actionRequiredTab} ${actionRequiredRoutes.length ? styles.hasActions : ""}`}
              >
                {actionRequiredRoutes.length} action
                {actionRequiredRoutes.length === 1 ? "" : "s"} required
              </Tabs.Trigger>
            </Tabs.List>
          </div>
          <Tabs.Content
            value="action-required"
            className={styles.tabContentPanel}
          >
            {loading ? (
              <p className={styles.rideListLoading}>Loading…</p>
            ) : actionRequiredRoutes.length ? (
              renderRideList(
                actionRequiredByDate,
                actionRequiredDateKeys,
                requestRideButton,
              )
            ) : (
              <p className={styles.rideListEmpty}>
                No rides need your attention.
              </p>
            )}
          </Tabs.Content>
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
