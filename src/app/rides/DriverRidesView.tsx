"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
import type { Shift } from "@/schemas/user";
import { useRouteUpdates } from "@/hooks/useRouteUpdates";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import type { DriverRideAction } from "@/utils/route-status";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";

import type { DriverRouteResponse as DriverRoute } from "@/types/api";

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

  const beginRequest = useLatestRequest();

  const fetchRoutes = useCallback(async () => {
    const isLatest = beginRequest();
    try {
      const range = activeTab === "today" ? todayRange : tomorrowRange;
      const params = new URLSearchParams({
        driver: userId,
        start_time: range[0].toISOString(),
        end_time: range[1].toISOString(),
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
  }, [userId, activeTab, todayRange, tomorrowRange, beginRequest]);

  useEffect(() => {
    if (!mounted) return;
    // Clear the previous day while loading routes for the selected day.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void fetchRoutes();
  }, [mounted, fetchRoutes]);

  useRouteUpdates(() => {
    if (mounted) void fetchRoutes();
  });

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
        // A refresh started before the mutation must not restore the old status.
        beginRequest();
        setRoutes((prev) =>
          prev.map((ride) => (ride.id === updated.id ? updated : ride)),
        );
        setConfirmRoute(null);
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
    [beginRequest],
  );

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
                busyRoutes.has(route.id) &&
                busyRoutes.get(route.id) !== "missing"
              }
              noShowBusy={busyRoutes.get(route.id) === "missing"}
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
