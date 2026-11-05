"use client";

import React, { useMemo, useState } from "react";

import AdminRidesTable, {
  type ColumnHeader,
  type TableRow,
} from "@/components/AdminRidesTable/AdminRidesTable";
import RideFilter from "./RideFilter";
import { adminStatusLabel } from "./RideStatusChip";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";
import { routeStatusLabels } from "@/utils/route-status";
import { formatEstDate, formatEstTime, withDelay } from "@/utils/dateEst";

import AdminChatView from "./AdminChatView";
import AssignRideModal from "./AssignRideModal";
import RideStatusChip from "./RideStatusChip";
import { useAdminRides, type RouteEntry } from "./useAdminRides";
import styles from "./ridesTable.module.css";

// Final Sprint 3 column order; space is shared by content length.
const COLUMNS: ColumnHeader[] = [
  { content: "Status", width: "13%" },
  { content: "Student", width: "14%" },
  { content: "Student Email", width: "18%" },
  { content: "Driver", width: "11%" },
  { content: "Date", width: "9%" },
  { content: "Pickup", width: "13%" },
  { content: "Dropoff", width: "13%" },
  { content: "Vehicle", width: "9%" },
];

// Admins may edit a ride in any status; the server accepts the same set.
// Cancelling still mirrors what cancelRoute accepts — anything already
// completed, missing or cancelled would just 409.
const CANCELLABLE_STATUSES = new Set<string>([
  "Requested",
  "Scheduled",
  "EnRoute",
  "Arrived",
  "Pickedup",
]);

function fullName(user: { firstName: string; lastName: string } | null) {
  return user ? `${user.firstName} ${user.lastName}` : "—";
}

function timeAt(
  iso: string | null | undefined,
  place: string | undefined,
  delayMinutes: number,
) {
  // Requested rides can have a destination before a dropoff estimate exists.
  if (!iso) return place ?? "—";
  const original = new Date(iso);
  const time = formatEstTime(withDelay(original, delayMinutes));
  if (!delayMinutes) return place ? `${time} @ ${place}` : time;
  return (
    <span className={styles.timeCell}>
      <span className={styles.delayedTime}>{time}</span>{" "}
      <span className={styles.originalTime}>
        <span className="sr-only">Originally </span>
        {formatEstTime(original)}
      </span>
      {place ? ` @ ${place}` : ""}
    </span>
  );
}

/** Attention items first, then rides in progress, then scheduled rides. */
function defaultOrder(a: RouteEntry, b: RouteEntry) {
  const priority = (status: string) =>
    ({
      ActionRequired: 0,
      Requested: 1,
      EnRoute: 2,
      Arrived: 3,
      Pickedup: 4,
      Scheduled: 5,
    })[status] ?? 6;
  return (
    priority(a.status) - priority(b.status) ||
    withDelay(new Date(a.scheduledPickupTime), a.delayMinutes ?? 0).getTime() -
      withDelay(new Date(b.scheduledPickupTime), b.delayMinutes ?? 0).getTime()
  );
}

export default function RidesTable() {
  const {
    routes,
    actionRequiredCount: actionCount,
    drivers,
    vehicles,
    loading,
    error,
    refreshError,
    refreshRoute,
  } = useAdminRides();

  const [statuses, setStatuses] = useState<string[]>([]);
  const [pickups, setPickups] = useState<string[]>([]);
  const [dropoffs, setDropoffs] = useState<string[]>([]);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [chatRoute, setChatRoute] = useState<RouteEntry | null>(null);
  const [assignRoute, setAssignRoute] = useState<RouteEntry | null>(null);
  const [pendingCancel, setPendingCancel] = useState<RouteEntry | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const statusOptions = Object.entries(routeStatusLabels).map(([value]) => ({
    value,
    label: adminStatusLabel(value),
  }));
  const locationOptions = (field: "pickup" | "dropoff") =>
    [
      ...new Map(
        routes.map((route) => [
          route[field].id,
          { value: route[field].id, label: route[field].name },
        ]),
      ).values(),
    ].sort((a, b) => a.label.localeCompare(b.label));

  const visibleRoutes = useMemo(
    () =>
      routes
        .filter(
          (route) =>
            (!statuses.length || statuses.includes(route.status)) &&
            (!pickups.length || pickups.includes(route.pickup.id)) &&
            (!dropoffs.length || dropoffs.includes(route.dropoff.id)) &&
            (!attentionOnly || route.status === "ActionRequired"),
        )
        .sort(defaultOrder),
    [routes, statuses, pickups, dropoffs, attentionOnly],
  );

  const handleCancel = async () => {
    if (!pendingCancel) return;
    const routeId = pendingCancel.id;
    setCanceling(true);
    setCancelError(null);
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
      refreshRoute(routeId);
      setPendingCancel(null);
    } catch (e) {
      setCancelError(
        e instanceof Error ? e.message : "Cancellation failed. Try again.",
      );
    } finally {
      setCanceling(false);
    }
  };

  const rows: TableRow[] = visibleRoutes.map((route) => {
    const canCancel = CANCELLABLE_STATUSES.has(route.status);
    const delayMinutes = route.delayMinutes ?? 0;
    const pickupAt = withDelay(
      new Date(route.scheduledPickupTime),
      delayMinutes,
    );
    const dropoffAt = route.estimatedDropoffTime
      ? withDelay(new Date(route.estimatedDropoffTime), delayMinutes)
      : null;

    return {
      key: route.id,
      label: fullName(route.student),
      actions: [
        { label: "Edit ride", onSelect: () => setAssignRoute(route) },
        { label: "Ride chat", onSelect: () => setChatRoute(route) },
        {
          label: "Cancel ride",
          disabled: !canCancel,
          onSelect: () => {
            setCancelError(null);
            setPendingCancel(route);
          },
        },
      ],
      cells: [
        {
          content: <RideStatusChip status={route.status} />,
          value: adminStatusLabel(route.status),
        },
        { content: fullName(route.student) },
        { content: route.student.email },
        { content: fullName(route.driver) },
        {
          content: formatEstDate(pickupAt),
          value: pickupAt.getTime(),
        },
        {
          content: timeAt(
            route.scheduledPickupTime,
            route.pickup?.name,
            delayMinutes,
          ),
          value: pickupAt.getTime(),
        },
        {
          content: timeAt(
            route.estimatedDropoffTime,
            route.dropoff?.name,
            delayMinutes,
          ),
          value: dropoffAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
        },
        { content: route.vehicle?.name ?? "—" },
      ],
    };
  });

  if (loading) return <p className={styles.notice}>Loading…</p>;
  if (error)
    return (
      <p className={styles.warning} role="status">
        {error}
      </p>
    );

  return (
    <>
      {refreshError && (
        <p className={styles.warning} role="status">
          {refreshError}
        </p>
      )}

      <AdminRidesTable
        columnHeaders={COLUMNS}
        rows={rows}
        searchPlaceholder="Search for a ride..."
        emptyMessage="No rides found."
        toolbarActions={
          <button
            type="button"
            className={
              actionCount ? styles.attentionButton : styles.attentionEmpty
            }
            aria-pressed={attentionOnly}
            disabled={!actionCount && !attentionOnly}
            onClick={() => setAttentionOnly((current) => !current)}
          >
            {actionCount} action{actionCount === 1 ? "" : "s"} required
          </button>
        }
        filters={
          <>
            <RideFilter
              label="Status"
              options={statusOptions}
              selected={statuses}
              onChange={setStatuses}
            />
            <RideFilter
              label="Pickup"
              options={locationOptions("pickup")}
              selected={pickups}
              onChange={setPickups}
            />
            <RideFilter
              label="Dropoff"
              options={locationOptions("dropoff")}
              selected={dropoffs}
              onChange={setDropoffs}
            />
          </>
        }
      />

      {assignRoute && (
        <AssignRideModal
          route={assignRoute}
          drivers={drivers}
          vehicles={vehicles}
          onClose={() => setAssignRoute(null)}
          onAssigned={(routeId) => {
            refreshRoute(routeId);
            setAssignRoute(null);
          }}
        />
      )}

      {chatRoute && (
        <div className={styles.drawerLayer}>
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label="Close chat"
            onClick={() => setChatRoute(null)}
          />
          <aside className={styles.drawer} aria-label="Chat transcript">
            <AdminChatView
              routeId={chatRoute.id}
              rideLabel={[
                fullName(chatRoute.student),
                chatRoute.driver
                  ? `Driver: ${fullName(chatRoute.driver)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              routeStatus={chatRoute.status}
              studentId={chatRoute.student.id}
              driverId={chatRoute.driver?.id ?? null}
              onClose={() => setChatRoute(null)}
            />
          </aside>
        </div>
      )}

      <ConfirmActionModal
        open={pendingCancel !== null}
        onOpenChange={(open) => {
          if (!open) setPendingCancel(null);
        }}
        onConfirm={handleCancel}
        title="Cancel this ride?"
        description={
          <>
            {pendingCancel
              ? `This cancels the ride for ${fullName(pendingCancel.student)}. This action cannot be undone.`
              : "This cancels the ride. This action cannot be undone."}
            {cancelError && (
              <span className={styles.modalError} role="alert">
                {cancelError}
              </span>
            )}
          </>
        }
        confirmLabel="Cancel ride"
        confirmingLabel="Canceling…"
        cancelLabel="Keep ride"
        confirming={canceling}
      />
    </>
  );
}
