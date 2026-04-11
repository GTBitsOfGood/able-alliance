"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import BogIcon from "@/components/BogIcon/BogIcon";
import styles from "./styles.module.css";

// ── Types ────────────────────────────────────────────────────────────────────

type RouteUser = { _id: string; firstName: string; lastName: string };
type RouteVehicle = {
  _id: string;
  vehicleId?: string;
  name: string;
  licensePlate: string;
};

type ShiftRoute = {
  _id: string;
  status: string;
  student: RouteUser & { studentInfo?: unknown };
  driver?: RouteUser;
  vehicle?: RouteVehicle;
  scheduledPickupTime: string;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  estimatedDropoffTime?: string;
  pickupLocationName: string;
  dropoffLocationName: string;
};

type ShiftDetail = {
  driver: { _id: string; firstName: string; lastName: string };
  date: string; // YYYY-MM-DD
  dayName: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  startTimeLabel: string;
  endTimeLabel: string;
  shiftStartIso: string;
  shiftEndIso: string;
  scheduledRoutes: ShiftRoute[];
  requestedRoutes: ShiftRoute[];
};

type Vehicle = {
  _id: string;
  vehicleId: string;
  name: string;
  licensePlate: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso: string): string {
  // iso is YYYY-MM-DD
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

/** Returns the pickup time in minutes from midnight (EST). */
function pickupMinutes(isoStr: string): number {
  const date = new Date(isoStr);
  const est = new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" }),
  );
  return est.getHours() * 60 + est.getMinutes();
}

/** Convert "HH:MM" to minutes from midnight */
function hhmm(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

/** Clamp a value between min and max */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ShiftDetailPage({
  params,
}: {
  params: Promise<{ driverId: string }>;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? "";

  const [driverId, setDriverId] = useState<string>("");
  useEffect(() => {
    params.then((p) => setDriverId(p.driverId));
  }, [params]);

  // Auth guard
  const userType = session?.user?.type;
  useEffect(() => {
    if (
      sessionStatus !== "loading" &&
      userType !== "Admin" &&
      userType !== "SuperAdmin"
    ) {
      router.replace("/");
    }
  }, [sessionStatus, userType, router]);

  // ── Data state ──
  const [shiftDetail, setShiftDetail] = useState<ShiftDetail | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loadingShift, setLoadingShift] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // ── Add Rides panel state ──
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedRideIds, setSelectedRideIds] = useState<Set<string>>(
    new Set(),
  );
  const [vehicleAssignments, setVehicleAssignments] = useState<
    Record<string, string>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch shift details
  const fetchShiftDetail = useCallback(() => {
    if (!driverId || !date) return;
    setLoadingShift(true);
    setFetchError(null);
    Promise.all([
      fetch(`/api/shifts/${driverId}?date=${date}`).then((r) => {
        if (!r.ok) throw new Error("Failed to fetch shift details");
        return r.json() as Promise<ShiftDetail>;
      }),
      fetch("/api/vehicles").then((r) => {
        if (!r.ok) throw new Error("Failed to fetch vehicles");
        return r.json() as Promise<Vehicle[]>;
      }),
    ])
      .then(([shift, veh]) => {
        setShiftDetail(shift);
        setVehicles(veh);
      })
      .catch((e: Error) => setFetchError(e.message))
      .finally(() => setLoadingShift(false));
  }, [driverId, date]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    if (userType !== "Admin" && userType !== "SuperAdmin") return;
    fetchShiftDetail();
  }, [fetchShiftDetail, sessionStatus, userType]);

  // ── Derived validation ──
  const shiftStartMin = shiftDetail ? hhmm(shiftDetail.startTime) : 0;
  const shiftEndMin = shiftDetail ? hhmm(shiftDetail.endTime) : 0;
  const shiftDuration = shiftEndMin - shiftStartMin;

  // Detect time conflicts: does any selected ride overlap an already-scheduled ride?
  const conflictRideIds = useMemo<Set<string>>(() => {
    if (!shiftDetail || selectedRideIds.size === 0) return new Set();
    const scheduled = shiftDetail.scheduledRoutes;
    const conflicts = new Set<string>();
    for (const rideId of selectedRideIds) {
      const ride = shiftDetail.requestedRoutes.find((r) => r._id === rideId);
      if (!ride) continue;
      const rideMin = pickupMinutes(ride.scheduledPickupTime);
      // Flag conflict if within 15 minutes of any scheduled ride
      const hasConflict = scheduled.some((s) => {
        const sMin = pickupMinutes(s.scheduledPickupTime);
        return Math.abs(rideMin - sMin) < 15;
      });
      if (hasConflict) conflicts.add(rideId);
    }
    return conflicts;
  }, [shiftDetail, selectedRideIds]);

  const missingVehicle = useMemo(
    () => [...selectedRideIds].some((id) => !vehicleAssignments[id]),
    [selectedRideIds, vehicleAssignments],
  );

  const hasConflicts = conflictRideIds.size > 0;
  const canConfirm =
    selectedRideIds.size > 0 && !hasConflicts && !missingVehicle && !submitting;

  // ── Timeline helpers ──
  function timelinePercent(minutes: number): number {
    if (shiftDuration <= 0) return 0;
    return clamp(((minutes - shiftStartMin) / shiftDuration) * 100, 0, 100);
  }

  // ── Handlers ──
  function toggleRide(rideId: string) {
    setSelectedRideIds((prev) => {
      const next = new Set(prev);
      if (next.has(rideId)) {
        next.delete(rideId);
      } else {
        next.add(rideId);
      }
      return next;
    });
  }

  function handleVehicleChange(rideId: string, vehicleId: string) {
    setVehicleAssignments((prev) => ({ ...prev, [rideId]: vehicleId }));
  }

  async function handleConfirm() {
    if (!canConfirm || !shiftDetail) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const rides = [...selectedRideIds].map((rideId) => ({
        rideId,
        vehicleId: vehicleAssignments[rideId],
      }));
      const res = await fetch(`/api/shifts/${driverId}/rides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rides }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Failed to assign rides");
      }
      // Reset panel and refresh data
      setShowAddPanel(false);
      setSelectedRideIds(new Set());
      setVehicleAssignments({});
      fetchShiftDetail();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancelAdd() {
    setShowAddPanel(false);
    setSelectedRideIds(new Set());
    setVehicleAssignments({});
    setSubmitError(null);
  }

  // ── Render guards ──
  if (
    sessionStatus === "loading" ||
    (userType !== "Admin" && userType !== "SuperAdmin")
  ) {
    return null;
  }

  if (loadingShift) {
    return (
      <div className={styles.page}>
        <p className={styles.empty}>Loading…</p>
      </div>
    );
  }

  if (fetchError || !shiftDetail) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{fetchError ?? "Shift not found."}</p>
      </div>
    );
  }

  const {
    driver,
    dayName,
    startTimeLabel,
    endTimeLabel,
    scheduledRoutes,
    requestedRoutes,
  } = shiftDetail;

  // ── Render ──
  return (
    <div className={styles.page}>
      {/* Back link */}
      <Link href="/admin/shifts" className={styles.backLink}>
        <BogIcon name="arrow-left" size={16} />
        Back to shifts
      </Link>

      <h1 className={styles.title}>Shift Details</h1>

      {/* Info card */}
      <div className={styles.infoCard}>
        <div className={styles.infoCardRow}>
          <div className={styles.infoField}>
            <span className={styles.infoLabel}>Driver</span>
            <span className={styles.infoValue}>
              {driver.firstName} {driver.lastName}
            </span>
          </div>
          <div className={styles.infoField}>
            <span className={styles.infoLabel}>Date</span>
            <span className={styles.infoValue}>{formatDate(date)}</span>
          </div>
        </div>
        <div className={styles.infoCardBottom}>
          <span className={styles.dayLabel}>{dayName}</span>
          <span className={styles.timeBadge}>
            {startTimeLabel} – {endTimeLabel}
          </span>
        </div>
      </div>

      {/* Scheduled Rides + Add Rides (in one card) */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Scheduled Rides</h2>
          {!showAddPanel && (
            <button
              type="button"
              className={styles.btnAddRide}
              onClick={() => setShowAddPanel(true)}
            >
              <BogIcon name="plus" size={14} />
              Add ride
            </button>
          )}
        </div>

        {scheduledRoutes.length === 0 ? (
          <p className={styles.empty}>No rides scheduled for this shift.</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Student</th>
                <th>Vehicle ID</th>
                <th>Date</th>
                <th>Pickup Window</th>
                <th>Pickup</th>
                <th>Dropoff</th>
              </tr>
            </thead>
            <tbody>
              {scheduledRoutes.map((route) => (
                <tr key={route._id}>
                  <td>
                    {route.student.firstName} {route.student.lastName}
                  </td>
                  <td>{route.vehicle?.vehicleId ?? "—"}</td>
                  <td>
                    {new Date(route.scheduledPickupTime).toLocaleDateString(
                      "en-US",
                      {
                        timeZone: "America/New_York",
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                      },
                    )}
                  </td>
                  <td>
                    {formatTime(route.pickupWindowStart)} –{" "}
                    {formatTime(route.pickupWindowEnd)}
                  </td>
                  <td>
                    {formatTime(route.scheduledPickupTime)} @{" "}
                    {route.pickupLocationName}
                  </td>
                  <td>
                    {route.estimatedDropoffTime
                      ? `${formatTime(route.estimatedDropoffTime)} @ `
                      : ""}
                    {route.dropoffLocationName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Add Rides panel — inside the same card, below a separator */}
        {showAddPanel && (
          <>
            <hr className={styles.separator} />
            <h2 className={styles.sectionTitle}>Add Rides</h2>

            {/* Timeline */}
            <div className={styles.timeline}>
              <div className={styles.timelineLabels}>
                <span>{startTimeLabel}</span>
                <span>{endTimeLabel}</span>
              </div>
              <div className={styles.timelineBar}>
                {/* Hour-mark ticks */}
                {Array.from({ length: shiftDuration / 60 - 1 }, (_, i) => (
                  <div
                    key={i}
                    className={styles.timelineHourMark}
                    style={{
                      left: `${(((i + 1) * 60) / shiftDuration) * 100}%`,
                    }}
                  />
                ))}
                {/* Already-scheduled rides — grey blocks marking occupied time */}
                {scheduledRoutes.map((r) => {
                  const left = timelinePercent(
                    pickupMinutes(r.scheduledPickupTime),
                  );
                  return (
                    <div
                      key={r._id}
                      className={`${styles.timelineBlock} ${styles.timelineBlockScheduled}`}
                      style={{ left: `${left}%`, width: "4%" }}
                    />
                  );
                })}
                {/* Selected-to-add rides */}
                {requestedRoutes
                  .filter((r) => selectedRideIds.has(r._id))
                  .map((r) => {
                    const left = timelinePercent(
                      pickupMinutes(r.scheduledPickupTime),
                    );
                    const isConflict = conflictRideIds.has(r._id);
                    return (
                      <div
                        key={r._id}
                        className={`${styles.timelineBlock} ${
                          isConflict
                            ? styles.timelineBlockConflict
                            : styles.timelineBlockSelected
                        }`}
                        style={{ left: `${left}%`, width: "4%" }}
                      />
                    );
                  })}
              </div>
            </div>

            {/* Requested rides table */}
            {requestedRoutes.length === 0 ? (
              <p className={styles.empty}>
                No unassigned rides available in this shift window.
              </p>
            ) : (
              <table className={styles.addTable}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Vehicle ID</th>
                    <th>Pickup</th>
                    <th>Dropoff</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {requestedRoutes.map((route) => {
                    const isSelected = selectedRideIds.has(route._id);
                    const isConflict = conflictRideIds.has(route._id);
                    return (
                      <tr
                        key={route._id}
                        className={isConflict ? styles.rowConflict : ""}
                      >
                        <td>
                          {route.student.firstName} {route.student.lastName}
                        </td>
                        <td>
                          <select
                            className={styles.vehicleSelect}
                            value={vehicleAssignments[route._id] ?? ""}
                            onChange={(e) =>
                              handleVehicleChange(route._id, e.target.value)
                            }
                          >
                            <option value="">—</option>
                            {vehicles.map((v) => (
                              <option key={v._id} value={v._id}>
                                {v.vehicleId || v.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {formatTime(route.scheduledPickupTime)} @{" "}
                          {route.pickupLocationName}
                        </td>
                        <td>
                          {route.estimatedDropoffTime
                            ? `${formatTime(route.estimatedDropoffTime)} @ `
                            : ""}
                          {route.dropoffLocationName}
                        </td>
                        <td>
                          <span
                            className={`${styles.badge} ${
                              isSelected
                                ? styles.badgeScheduled
                                : styles.badgeRequested
                            }`}
                          >
                            {isSelected ? "Scheduled" : "Requested"}
                          </span>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={isSelected}
                            onChange={() => toggleRide(route._id)}
                            aria-label={`Select ride for ${route.student.firstName} ${route.student.lastName}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Footer: error / warning / buttons */}
            <div className={styles.addRidesFooter}>
              {hasConflicts && (
                <span className={`${styles.bannerRow} ${styles.bannerError}`}>
                  <BogIcon name="warning" size={16} />
                  Added rides have schedule conflicts!
                </span>
              )}
              {!hasConflicts && missingVehicle && (
                <span className={`${styles.bannerRow} ${styles.bannerWarning}`}>
                  <BogIcon name="warning" size={16} />
                  All selected rides must have an assigned vehicle.
                </span>
              )}
              {submitError && (
                <span className={`${styles.bannerRow} ${styles.bannerError}`}>
                  {submitError}
                </span>
              )}

              <button
                type="button"
                className={styles.btnSecondary}
                onClick={handleCancelAdd}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={handleConfirm}
                disabled={!canConfirm}
              >
                {submitting ? "Confirming…" : "Confirm rides"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
