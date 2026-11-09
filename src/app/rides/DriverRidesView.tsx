"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import RideWeekPicker from "./RideWeekPicker";
import UpNextHeading from "./UpNextHeading";
import listStyles from "./student-rides.module.css";
import { RideCard } from "./RideCard";
import styles from "./styles.module.css";
import {
  estDayOfWeek,
  estDateKey,
  estWeekRange,
  estTimeStr,
  formatEstDate,
} from "@/utils/dateEst";
import type { Shift } from "@/schemas/user";
import { useRouteUpdates } from "@/hooks/useRouteUpdates";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import { getNextRide } from "@/utils/nextRide";
import type { DriverRideAction } from "@/utils/route-status";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";

import type { DriverRouteResponse as DriverRoute } from "@/types/api";

function formatDayHeading(day: Date) {
  return formatEstDate(day, {
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

function confirmationDescription(route: DriverRoute, action: DriverRideAction) {
  const studentName =
    `${route.student.preferredName || route.student.firstName} ${route.student.lastName}`.trim();
  switch (action.endpoint) {
    case "arrive":
      return `I have arrived at ${route.pickup.name}. The student will be notified.`;
    case "pickup":
      return `I have picked up ${studentName}.`;
    case "complete":
      return `I have dropped off ${studentName}. This will complete the ride.`;
    case "missing":
      return `${studentName} did not show up for their ride.`;
    default:
      return undefined;
  }
}

export default function DriverRidesView({ userId }: { userId: string }) {
  const [mounted, setMounted] = useState(false);
  const [routes, setRoutes] = useState<DriverRoute[]>([]);
  const [upNextRoutes, setUpNextRoutes] = useState<DriverRoute[]>([]);
  const [upNextError, setUpNextError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyRoutes, setBusyRoutes] = useState<
    Map<string, DriverRideAction["endpoint"]>
  >(new Map());
  const pendingActions = useRef(new Set<string>());
  const [confirmRoute, setConfirmRoute] = useState<{
    route: DriverRoute;
    action: DriverRideAction;
  } | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const todayKey = mounted ? estDateKey(new Date(now)) : "";
  const weekRange = useMemo(
    () =>
      todayKey
        ? estWeekRange(weekOffset)
        : ([new Date(0), new Date(0)] as [Date, Date]),
    [todayKey, weekOffset],
  );
  const weekDays = useMemo(() => {
    if (!mounted) return [];
    const firstDay = toZonedTime(weekRange[0], "America/New_York");
    const todayKey = estDateKey(new Date());
    return Array.from({ length: 7 }, (_, index) =>
      fromZonedTime(addDays(firstDay, index), "America/New_York"),
    ).filter((day) => estDateKey(day) >= todayKey);
  }, [mounted, weekRange]);

  useEffect(() => {
    // Date-dependent UI must wait until hydration finishes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const beginRequest = useLatestRequest();
  const beginUpNextRequest = useLatestRequest();

  const fetchUpNextRoutes = useCallback(async () => {
    if (!todayKey) return;
    const isLatest = beginUpNextRequest();
    const params = new URLSearchParams({
      driver: userId,
    });
    try {
      const response = await fetch(`/api/routes?${params}`);
      if (!response.ok) throw new Error("Failed to fetch upcoming rides");
      const data: DriverRoute[] = await response.json();
      if (!isLatest()) return;
      setUpNextRoutes(data);
      setUpNextError(null);
    } catch (error) {
      if (!isLatest()) return;
      setUpNextError(
        error instanceof Error
          ? error.message
          : "Failed to fetch upcoming rides",
      );
    }
  }, [userId, todayKey, beginUpNextRequest]);

  const refreshUpNextRoutes = useRef(fetchUpNextRoutes);
  useEffect(() => {
    refreshUpNextRoutes.current = fetchUpNextRoutes;
    // This effect starts an asynchronous API request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchUpNextRoutes();
  }, [fetchUpNextRoutes]);

  const upNext = mounted ? getNextRide(upNextRoutes, now) : undefined;

  const fetchRoutes = useCallback(async () => {
    const isLatest = beginRequest();
    try {
      const params = new URLSearchParams({
        driver: userId,
        start_time: weekRange[0].toISOString(),
        end_time: weekRange[1].toISOString(),
      });

      const [routesRes, driverRes] = await Promise.all([
        fetch(`/api/routes?${params}`),
        fetch(`/api/users/${userId}`).catch(() => null),
      ]);
      if (!routesRes.ok) throw new Error("Failed to fetch routes");

      const routesData: DriverRoute[] = await routesRes.json();
      const shiftsData: Shift[] = driverRes?.ok
        ? ((await driverRes.json()).shifts ?? [])
        : [];
      if (!isLatest()) return;
      setRoutes(
        routesData.toSorted((a, b) =>
          a.scheduledPickupTime.localeCompare(b.scheduledPickupTime),
        ),
      );
      // Missing shift information must not hide assigned rides.
      setShifts(shiftsData);
      setError(null);
    } catch (e) {
      if (!isLatest()) return;
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [userId, weekRange, beginRequest]);

  const refreshRoutes = useRef(fetchRoutes);
  useEffect(() => {
    refreshRoutes.current = fetchRoutes;
  }, [fetchRoutes]);

  useEffect(() => {
    if (!mounted) return;
    // This effect starts an asynchronous API request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRoutes();
  }, [mounted, fetchRoutes]);

  useRouteUpdates(() => {
    if (mounted) {
      void fetchRoutes();
      void fetchUpNextRoutes();
    }
  });

  function changeWeek(offset: number) {
    if (offset === weekOffset) return;
    // Immediately invalidate an in-flight load before the next effect runs.
    beginRequest();
    setLoading(true);
    setWeekOffset(offset);
  }

  const handleDriverAction = useCallback(
    async (route: DriverRoute, action: DriverRideAction) => {
      const routeId = route.id;
      if (pendingActions.current.has(routeId)) return;
      pendingActions.current.add(routeId);
      setBusyRoutes((prev) => new Map(prev).set(routeId, action.endpoint));
      setError(null);
      try {
        const res = await fetch(`/api/routes/${action.endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ routeId }),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to update ride");
          return;
        }
        const updated: DriverRoute = await res.json();
        setRoutes((prev) =>
          prev.map((ride) => (ride.id === updated.id ? updated : ride)),
        );
        setUpNextRoutes((prev) =>
          prev.map((ride) => (ride.id === updated.id ? updated : ride)),
        );
        setConfirmRoute(null);
        // The action may have started on a different week. Use the current
        // fetcher so any stale load is replaced, including its loading cleanup.
        void refreshRoutes.current();
        void refreshUpNextRoutes.current();
      } catch {
        setError("Failed to update ride");
      } finally {
        pendingActions.current.delete(routeId);
        setBusyRoutes((prev) => {
          const next = new Map(prev);
          next.delete(routeId);
          return next;
        });
      }
    },
    [],
  );

  function renderRideCard(route: DriverRoute) {
    return (
      <RideCard
        key={route.id}
        route={route}
        isDriverCard
        href={`/rides/${route.id}`}
        onDriverAction={(action) => {
          setError(null);
          if (action.endpoint === "start")
            void handleDriverAction(route, action);
          else setConfirmRoute({ route, action });
        }}
        driverActionBusy={
          busyRoutes.has(route.id) && busyRoutes.get(route.id) !== "missing"
        }
        noShowBusy={busyRoutes.get(route.id) === "missing"}
      />
    );
  }

  function renderRides() {
    const days = weekDays
      .map((day) => ({
        day,
        groups: groupRidesByShift(
          routes.filter(
            (route) =>
              estDateKey(new Date(route.scheduledPickupTime)) ===
              estDateKey(day),
          ),
          shifts,
          day,
        ),
      }))
      .filter(({ groups }) => groups.length > 0);

    if (days.length === 0) {
      return (
        <p className={styles.rideListEmpty}>No shifts or rides this week.</p>
      );
    }
    return days.map(({ day, groups }) => (
      <section key={estDateKey(day)} className={styles.driverWeekDay}>
        <h3 className={listStyles.dayHeading}>{formatDayHeading(day)}</h3>
        {groups.map((shiftGroup) => (
          <div key={shiftGroup.key} className={styles.driverDayGroup}>
            {shiftGroup.heading && (
              <h4 className={styles.driverDayHeading}>{shiftGroup.heading}</h4>
            )}
            <div className={styles.driverDayCards}>
              {shiftGroup.rides.length === 0 && (
                <p className={styles.rideListEmpty}>No rides yet.</p>
              )}
              {shiftGroup.rides.map(renderRideCard)}
            </div>
          </div>
        ))}
      </section>
    ));
  }

  return (
    <main className={`${styles.main} ${styles.driverWeeklyMain}`}>
      <div className={styles.mainHeader}>
        <h1 className={listStyles.title}>Your Rides</h1>
      </div>

      {error && (
        <p className={listStyles.error} role="alert">
          {error}
        </p>
      )}

      {upNextError && (
        <p className={listStyles.error} role="alert">
          {upNextError}
        </p>
      )}

      {upNext && (
        <section
          className={styles.driverWeekDay}
          aria-labelledby="driver-up-next-heading"
        >
          <UpNextHeading
            id="driver-up-next-heading"
            pickupTime={upNext.scheduledPickupTime}
            delayMinutes={upNext.delayMinutes}
          />
          {renderRideCard(upNext)}
        </section>
      )}

      <section
        className={listStyles.upcoming}
        aria-label="Driver ride schedule"
      >
        <RideWeekPicker
          weekOffset={weekOffset}
          onWeekChange={changeWeek}
          ready={mounted}
        />
        <div className={styles.driverWeekDays} aria-busy={loading}>
          {loading ? (
            <p className={styles.rideListLoading} role="status">
              Loading…
            </p>
          ) : (
            renderRides()
          )}
        </div>
      </section>
      <ConfirmActionModal
        open={confirmRoute !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmRoute(null);
        }}
        title={confirmRoute?.action.title ?? "Update ride"}
        description={
          confirmRoute
            ? confirmationDescription(confirmRoute.route, confirmRoute.action)
            : undefined
        }
        confirmLabel={confirmRoute?.action.confirmLabel ?? "Confirm"}
        confirmingLabel={confirmRoute?.action.confirmingLabel}
        cancelLabel="Cancel"
        variant={confirmRoute?.action.variant ?? "primary"}
        confirming={
          confirmRoute ? busyRoutes.has(confirmRoute.route.id) : false
        }
        onConfirm={() =>
          confirmRoute
            ? handleDriverAction(confirmRoute.route, confirmRoute.action)
            : undefined
        }
      >
        {error && <p role="alert">{error}</p>}
      </ConfirmActionModal>
    </main>
  );
}
