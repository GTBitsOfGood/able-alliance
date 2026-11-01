"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";

import AdminRidesTable, {
  type ColumnHeader,
  type TableRow,
} from "@/components/AdminRidesTable/AdminRidesTable";
import BogDropdown from "@/components/BogDropdown/BogDropdown";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";
import { routeStatusLabels } from "@/utils/route-status";
import { formatEstDate, formatEstTime } from "@/utils/dateEst";

import AdminChatView from "./AdminChatView";
import AssignRideModal from "./AssignRideModal";
import RideStatusChip from "./RideStatusChip";
import { useAdminRides, type RouteEntry } from "./useAdminRides";
import styles from "./ridesTable.module.css";

// Widths follow the design's column geometry (117/181/181/118/80/115/143/142
// of a 1077px table).
const COLUMNS: ColumnHeader[] = [
  { content: "Student", width: "10.9%" },
  { content: "Driver", width: "16.8%" },
  { content: "Vehicle", width: "16.8%" },
  { content: "Status", width: "11%" },
  { content: "Date", width: "7.4%" },
  { content: "Pickup", width: "10.7%" },
  { content: "Dropoff", width: "13.3%" },
  { content: "Action", width: "13.1%" },
];

const SORT_OPTIONS = [
  "Date (earliest first)",
  "Date (latest first)",
  "Student (A–Z)",
  "Student (Z–A)",
  "Status",
] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const ALL_STATUSES = "All statuses";
const requestedLabel = routeStatusLabels.Requested;

// Mirror what the server accepts: scheduleRoute only moves a ride out of
// Requested, and cancelRoute refuses anything already completed, missing or
// cancelled. Offering either action on those rides would just 409.
const ASSIGNABLE_STATUSES = new Set<string>(["Requested"]);
const CANCELLABLE_STATUSES = new Set<string>([
  "Requested",
  "Scheduled",
  "EnRoute",
  "Pickedup",
]);

function fullName(user: { firstName: string; lastName: string } | null) {
  return user ? `${user.firstName} ${user.lastName}` : "—";
}

function timeAt(iso: string | null | undefined, place: string | undefined) {
  if (!iso) return "—";
  const time = formatEstTime(new Date(iso));
  return place ? `${time} @ ${place}` : time;
}

function statusLabel(status: string) {
  return routeStatusLabels[status as keyof typeof routeStatusLabels] ?? status;
}

/** Requested rides sit above the rest, newest-scheduled last. */
function defaultOrder(a: RouteEntry, b: RouteEntry) {
  const aRequested = a.status === "Requested" ? 0 : 1;
  const bRequested = b.status === "Requested" ? 0 : 1;
  if (aRequested !== bRequested) return aRequested - bRequested;
  return (
    new Date(a.scheduledPickupTime).getTime() -
    new Date(b.scheduledPickupTime).getTime()
  );
}

function compareBy(sort: SortOption) {
  switch (sort) {
    case "Date (earliest first)":
      return (a: RouteEntry, b: RouteEntry) =>
        new Date(a.scheduledPickupTime).getTime() -
        new Date(b.scheduledPickupTime).getTime();
    case "Date (latest first)":
      return (a: RouteEntry, b: RouteEntry) =>
        new Date(b.scheduledPickupTime).getTime() -
        new Date(a.scheduledPickupTime).getTime();
    case "Student (A–Z)":
      return (a: RouteEntry, b: RouteEntry) =>
        fullName(a.student).localeCompare(fullName(b.student));
    case "Student (Z–A)":
      return (a: RouteEntry, b: RouteEntry) =>
        fullName(b.student).localeCompare(fullName(a.student));
    case "Status":
      return (a: RouteEntry, b: RouteEntry) =>
        statusLabel(a.status).localeCompare(statusLabel(b.status));
  }
}

export default function RidesTable() {
  const {
    routes,
    drivers,
    vehicles,
    loading,
    error,
    refreshError,
    refreshRoute,
  } = useAdminRides();

  const [sort, setSort] = useState<SortOption | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_STATUSES);
  const [chatRoute, setChatRoute] = useState<RouteEntry | null>(null);
  const [assignRoute, setAssignRoute] = useState<RouteEntry | null>(null);
  const [pendingCancel, setPendingCancel] = useState<RouteEntry | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const requestedCount = routes.filter((r) => r.status === "Requested").length;

  const statusOptions = useMemo(() => {
    const present = new Set(routes.map((r) => statusLabel(r.status)));
    return [ALL_STATUSES, ...[...present].sort()];
  }, [routes]);

  const visibleRoutes = useMemo(() => {
    const filtered =
      statusFilter === ALL_STATUSES
        ? routes
        : routes.filter((r) => statusLabel(r.status) === statusFilter);
    return [...filtered].sort(sort ? compareBy(sort) : defaultOrder);
  }, [routes, sort, statusFilter]);

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
    const canAssign = ASSIGNABLE_STATUSES.has(route.status);
    const canCancel = CANCELLABLE_STATUSES.has(route.status);

    return {
      key: route.id,
      cells: [
        { content: fullName(route.student) },
        { content: fullName(route.driver) },
        { content: route.vehicle?.name ?? "—" },
        { content: <RideStatusChip status={route.status} /> },
        { content: formatEstDate(new Date(route.scheduledPickupTime)) },
        { content: timeAt(route.scheduledPickupTime, route.pickup?.name) },
        { content: timeAt(route.estimatedDropoffTime, route.dropoff?.name) },
        {
          content: (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.actionButton}
                disabled={!canAssign}
                title={
                  canAssign
                    ? undefined
                    : `A ${statusLabel(route.status).toLowerCase()} ride can't be edited`
                }
                aria-label={`Edit ride for ${fullName(route.student)}`}
                onClick={() => setAssignRoute(route)}
              >
                <Image
                  src="/ride-action-edit.svg"
                  alt=""
                  width={18}
                  height={18}
                />
              </button>
              <button
                type="button"
                className={styles.actionButton}
                aria-label={`Open chat for ${fullName(route.student)}`}
                onClick={() => setChatRoute(route)}
              >
                <Image
                  src="/ride-action-chat.svg"
                  alt=""
                  width={21}
                  height={20}
                />
              </button>
              <button
                type="button"
                className={styles.actionButton}
                disabled={!canCancel}
                title={
                  canCancel
                    ? undefined
                    : `A ${statusLabel(route.status).toLowerCase()} ride can't be cancelled`
                }
                aria-label={`Cancel ride for ${fullName(route.student)}`}
                onClick={() => {
                  setCancelError(null);
                  setPendingCancel(route);
                }}
              >
                <Image
                  src="/ride-action-cancel.svg"
                  alt=""
                  width={18}
                  height={18}
                />
              </button>
            </div>
          ),
        },
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
          <>
            <BogDropdown
              name="sort-rides"
              options={[...SORT_OPTIONS]}
              placeholder="Sort By"
              value={sort ?? ""}
              className={styles.toolbarControl}
              onSelectionChange={(selection) => {
                const value =
                  typeof selection === "string" ? selection : selection[0];
                setSort((value as SortOption) || null);
              }}
            />
            <BogDropdown
              name="filter-rides"
              options={statusOptions}
              placeholder="Filter"
              value={statusFilter === ALL_STATUSES ? "" : statusFilter}
              className={styles.toolbarControl}
              onSelectionChange={(selection) => {
                const value =
                  typeof selection === "string" ? selection : selection[0];
                setStatusFilter(value || ALL_STATUSES);
              }}
            />
            {requestedCount > 0 ? (
              <button
                type="button"
                className={styles.requestedLink}
                aria-pressed={statusFilter === requestedLabel}
                onClick={() =>
                  setStatusFilter((current) =>
                    current === requestedLabel ? ALL_STATUSES : requestedLabel,
                  )
                }
              >
                {requestedCount} ride{requestedCount === 1 ? "" : "s"} requested
              </button>
            ) : (
              <span className={styles.requestedNone}>No rides requested</span>
            )}
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
