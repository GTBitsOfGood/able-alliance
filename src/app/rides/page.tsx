"use client";

import { RouteStatus } from "@db/generated/enums";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { DropdownMenu } from "radix-ui";
import RideWeekPicker from "./RideWeekPicker";
import UpNextHeading from "./UpNextHeading";
import Link from "next/link";
import BogButton from "@/components/BogButton/BogButton";
import BogIcon from "@/components/BogIcon/BogIcon";
import studentStyles from "./student-rides.module.css";
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

import { getNextRide } from "@/utils/nextRide";

import type { RouteResponse as Route } from "@/types/api";

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
  const [weekOffset, setWeekOffset] = useState(0);

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

  const weekRange = React.useMemo(
    () =>
      mounted
        ? estWeekRange(weekOffset)
        : ([new Date(0), new Date(0)] as [Date, Date]),
    [mounted, weekOffset],
  );
  const todayKey = mounted ? estDateKey(new Date()) : "";
  const routesByDate = groupRoutesByDate(
    routes.filter((route) => isInRange(route.scheduledPickupTime, weekRange)),
  );
  const dateKeys = Object.keys(routesByDate)
    .sort()
    .filter((key) => key >= todayKey);

  const actionRequiredRoutes = routes.filter(
    (route) => route.status === RouteStatus.ActionRequiredByStudent,
  );
  const actionRequiredByDate = groupRoutesByDate(actionRequiredRoutes);
  const actionRequiredDateKeys = Object.keys(actionRequiredByDate).sort();

  const upNext = mounted ? getNextRide(routes) : undefined;

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

  function renderRideCard(route: Route) {
    return (
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
    );
  }

  function renderRideList(grouped: Record<string, Route[]>, keys: string[]) {
    return (
      <div className={styles.rideList}>
        {keys.length === 0 && (
          <p className={styles.rideListEmpty}>No rides yet.</p>
        )}
        {keys.map((dateKey) => (
          <section key={dateKey} className={styles.dateGroup}>
            <h3 className={studentStyles.dayHeading}>
              {formatDayGroupHeader(grouped[dateKey][0].scheduledPickupTime)}
            </h3>
            <div className={styles.dateGroupCards}>
              {grouped[dateKey].map(renderRideCard)}
            </div>
          </section>
        ))}
      </div>
    );
  }

  const requestRideButton = (
    <div className={styles.requestRideButtonGroup}>
      <Link href="/rides/new" className={studentStyles.requestLink}>
        <BogIcon name="plus" size={20} color="currentColor" />
        Request new ride
      </Link>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <BogButton
            className={styles.requestRideMenuButton}
            aria-label="More ride request options"
          >
            <BogIcon name="chevron-down" size={20} color="currentColor" />
          </BogButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={studentStyles.requestMenu}
            align="end"
            sideOffset={4}
          >
            <DropdownMenu.Item asChild>
              <Link href="/rides/new/batch">Request multiple rides</Link>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
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
      <main className={`${styles.main} ${styles.studentMain}`}>
        <div className={studentStyles.header}>
          <h1 className={studentStyles.title}>Your Rides</h1>
          {requestRideButton}
        </div>

        {error && (
          <p className={studentStyles.error} role="alert">
            {error}
          </p>
        )}

        {!loading && actionRequiredRoutes.length > 0 && (
          <section
            className={studentStyles.attention}
            aria-labelledby="attention-heading"
          >
            <h2 id="attention-heading" className={studentStyles.sectionTitle}>
              {actionRequiredRoutes.length} action
              {actionRequiredRoutes.length === 1 ? "" : "s"} required
            </h2>
            <p className={studentStyles.description}>
              Review the proposed changes to your rides.
            </p>
            {renderRideList(actionRequiredByDate, actionRequiredDateKeys)}
          </section>
        )}

        <section
          className={studentStyles.upNext}
          aria-labelledby="up-next-heading"
        >
          <UpNextHeading
            id="up-next-heading"
            pickupTime={upNext?.scheduledPickupTime}
            delayMinutes={upNext?.delayMinutes}
          />
          {loading ? (
            <p className={styles.rideListLoading} role="status">
              Loading…
            </p>
          ) : upNext ? (
            renderRideCard(upNext)
          ) : (
            <p className={styles.rideListEmpty}>No upcoming rides.</p>
          )}
        </section>

        <section
          className={studentStyles.upcoming}
          aria-labelledby="upcoming-heading"
        >
          <h2 id="upcoming-heading" className={studentStyles.sectionTitle}>
            Upcoming Rides
          </h2>
          <RideWeekPicker
            weekOffset={weekOffset}
            onWeekChange={setWeekOffset}
            ready={mounted}
          />
          <div aria-busy={loading}>
            {loading ? (
              <p className={styles.rideListLoading} role="status">
                Loading…
              </p>
            ) : (
              renderRideList(routesByDate, dateKeys)
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
