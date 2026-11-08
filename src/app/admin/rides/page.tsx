"use client";

import { RouteStatus } from "@db/generated/enums";

import { useRouter } from "next/navigation";
import { EDITABLE_RIDE_STATUSES } from "@/utils/route-status";

import React, { useMemo, useState } from "react";

import AdminRidesTable, {
  type ColumnHeader,
  type TableRow,
} from "@/components/AdminRidesTable/AdminRidesTable";
import RideFilter from "@/components/admin/RideFilter";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";
import CancelScopeOptions, {
  type CancelScope,
} from "@/components/CancelScopeOptions/CancelScopeOptions";
import { routeStatusLabels } from "@/utils/route-status";
import { formatEstDate, formatEstTime, withDelay } from "@/utils/dateEst";

import AdminChatView from "@/components/admin/AdminChatView";
import AssignRideModal from "@/components/admin/AssignRideModal";
import RideStatusChip from "@/components/admin/RideStatusChip";
import { useAdminRides } from "@/hooks/useAdminRides";
import type { RouteEntry } from "@/types/admin";
import styles from "@/components/admin/ridesTable.module.css";

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

// Cancelling still mirrors what cancelRoute accepts — anything already
// completed, missing or cancelled would just 409.
const CANCELLABLE_STATUSES = new Set<RouteStatus>([
  RouteStatus.Requested,
  RouteStatus.ActionRequiredByAdmin,
  RouteStatus.ActionRequiredByStudent,
  RouteStatus.Scheduled,
  RouteStatus.EnRoute,
  RouteStatus.Arrived,
  RouteStatus.Pickedup,
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
  const priorities: Partial<Record<RouteStatus, number>> = {
    [RouteStatus.ActionRequiredByAdmin]: 0,
    [RouteStatus.Requested]: 1,
    [RouteStatus.EnRoute]: 2,
    [RouteStatus.Arrived]: 3,
    [RouteStatus.Pickedup]: 4,
    [RouteStatus.Scheduled]: 5,
  };
  const priority = (status: RouteStatus) => priorities[status] ?? 6;
  return (
    priority(a.status) - priority(b.status) ||
    withDelay(new Date(a.scheduledPickupTime), a.delayMinutes ?? 0).getTime() -
      withDelay(new Date(b.scheduledPickupTime), b.delayMinutes ?? 0).getTime()
  );
}

export default function AdminRidesPage() {
  const router = useRouter();

  const {
    routes,
    actionRequiredCount: actionCount,
    drivers,
    vehicles,
    loading,
    error,
    refreshError,
    refreshRoute,
    refreshRoutes,
  } = useAdminRides();

  const [statuses, setStatuses] = useState<string[]>([]);
  const [pickups, setPickups] = useState<string[]>([]);
  const [dropoffs, setDropoffs] = useState<string[]>([]);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [chatRouteId, setChatRouteId] = useState<string | null>(null);
  const chatRoute = routes.find((route) => route.id === chatRouteId) ?? null;
  const [assignRoute, setAssignRoute] = useState<RouteEntry | null>(null);
  const [pendingCancel, setPendingCancel] = useState<RouteEntry | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelScope, setCancelScope] = useState<CancelScope>("single");

  const statusOptions = Object.entries(routeStatusLabels).map(
    ([value, label]) => ({
      value,
      label,
    }),
  );
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
            (!attentionOnly ||
              route.status === RouteStatus.ActionRequiredByAdmin ||
              route.status === RouteStatus.Requested),
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
        body: JSON.stringify({ routeId, scope: cancelScope }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      if (cancelScope === "series") refreshRoutes();
      else refreshRoute(routeId);
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
        ...(route.status === RouteStatus.Requested
          ? [{ label: "Schedule ride", onSelect: () => setAssignRoute(route) }]
          : []),
        {
          label: "Edit driver and vehicle",
          disabled:
            route.status === RouteStatus.Requested ||
            !EDITABLE_RIDE_STATUSES.has(route.status),
          onSelect: () => setAssignRoute(route),
        },
        ...(EDITABLE_RIDE_STATUSES.has(route.status)
          ? [
              {
                label: "Edit ride",
                onSelect: () => router.push(`/rides/${route.id}/edit`),
              },
            ]
          : []),
        ...(route.status === RouteStatus.ActionRequiredByAdmin
          ? [
              {
                label: "Review changes",
                onSelect: () => router.push(`/rides/${route.id}/review`),
              },
            ]
          : []),
        { label: "Ride chat", onSelect: () => setChatRouteId(route.id) },
        {
          label: "Cancel ride",
          disabled: !canCancel,
          onSelect: () => {
            setCancelError(null);
            setCancelScope("single");
            setPendingCancel(route);
          },
        },
      ],
      cells: [
        {
          content: <RideStatusChip status={route.status} />,
          value: routeStatusLabels[route.status],
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

  return (
    <div className="py-[var(--layout-content-pad-y)] px-[var(--layout-admin-pad-x)] relative flex flex-col flex-1 min-w-0 w-full lg:pt-[6.4rem] lg:pl-[5.6rem] lg:pr-[2.6rem]">
      <h1 className="text-display mb-[6.4rem]">Rides</h1>
      {loading ? (
        <p className={styles.notice}>Loading…</p>
      ) : error ? (
        <p className={styles.warning} role="status">
          {error}
        </p>
      ) : (
        <>
          {refreshError && (
            <p className={styles.warning} role="status">
              {refreshError}
            </p>
          )}

          <AdminRidesTable
            columnControls
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
            <AdminChatView
              key={chatRoute.id}
              presentation="dialog"
              routeId={chatRoute.id}
              rideLabel={[
                `Student: ${fullName(chatRoute.student)}`,
                chatRoute.driver
                  ? `Driver: ${fullName(chatRoute.driver)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              routeStatus={chatRoute.status}
              studentId={chatRoute.student.id}
              driverId={chatRoute.driver?.id ?? null}
              onClose={() => setChatRouteId(null)}
            />
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
                {pendingCancel?.seriesId &&
                  " This is a recurring ride. Choose which rides to cancel."}
                {cancelError && (
                  <span className={styles.modalError} role="alert">
                    {cancelError}
                  </span>
                )}
              </>
            }
            confirmLabel={
              cancelScope === "series" ? "Cancel rides" : "Cancel ride"
            }
            confirmingLabel="Canceling…"
            cancelLabel="Keep ride"
            confirming={canceling}
          >
            {pendingCancel?.seriesId && (
              <CancelScopeOptions
                value={cancelScope}
                onChange={setCancelScope}
                disabled={canceling}
              />
            )}
          </ConfirmActionModal>
        </>
      )}
    </div>
  );
}
