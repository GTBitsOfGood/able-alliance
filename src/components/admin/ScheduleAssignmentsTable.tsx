"use client";

import type { RefObject } from "react";
import Link from "next/link";

import { formatMinutes, formatMinuteRange } from "@/utils/rideTiming";
import type { AutoSchedulePlan, ScheduleRide } from "@/types/autoSchedule";
import type { VehicleEntry } from "@/types/admin";

import styles from "./schedule.module.css";

interface ScheduleAssignmentsTableProps {
  rideRows: ScheduleRide[];
  drivers: AutoSchedulePlan["drivers"];
  vehicles: VehicleEntry[];
  generated: boolean;
  busy: boolean;
  stale: boolean;
  tableRefs: RefObject<Map<string, HTMLTableRowElement>>;
  onAssignmentChange: (
    rideId: string,
    field: "driverId" | "vehicleId",
    value: string,
  ) => Promise<void>;
}

export default function ScheduleAssignmentsTable({
  rideRows,
  drivers,
  vehicles,
  generated,
  busy,
  stale,
  tableRefs,
  onAssignmentChange,
}: ScheduleAssignmentsTableProps) {
  return (
    <section className={styles.section} aria-label="Ride assignments">
      <h3>{generated ? "Review Assignments" : "Ride Assignments"}</h3>
      {!rideRows.length ? (
        <p className={styles.empty}>No ride requests for this day.</p>
      ) : (
        <div
          className={styles.tableScroll}
          tabIndex={0}
          role="region"
          aria-label="Scrollable assignments table"
        >
          <table className={styles.table}>
            <thead>
              <tr>
                {[
                  "Status",
                  "Student",
                  "Driver",
                  "Vehicle",
                  "Pickup",
                  "Dropoff",
                ].map((heading) => (
                  <th key={heading} scope="col">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rideRows.map((ride) => (
                <tr
                  key={ride.id}
                  tabIndex={-1}
                  ref={(node) => {
                    if (node) {
                      tableRefs.current.set(ride.id, node);
                    } else {
                      tableRefs.current.delete(ride.id);
                    }
                  }}
                >
                  <td>
                    <span
                      className={`${styles.chip} ${styles[ride.needsReview ? "unassigned" : ride.kind]}`}
                    >
                      {ride.needsReview
                        ? "Needs Review"
                        : ride.kind === "existing"
                          ? "Scheduled"
                          : ride.kind === "proposed"
                            ? "Proposed"
                            : "Requested"}
                    </span>
                  </td>
                  <td>
                    <Link href={`/rides/${ride.id}`}>{ride.studentName}</Link>
                    {ride.accommodations.length > 0 && (
                      <small>{ride.accommodations.join(", ")}</small>
                    )}
                    {ride.reason && (
                      <small className={ride.needsReview ? styles.reason : ""}>
                        {ride.reason}
                      </small>
                    )}
                  </td>
                  <td>
                    {ride.kind === "proposed" ? (
                      <select
                        aria-label={`Driver for ${ride.studentName}`}
                        value={ride.driverId}
                        disabled={busy || stale}
                        onChange={(e) =>
                          onAssignmentChange(
                            ride.id,
                            "driverId",
                            e.target.value,
                          )
                        }
                      >
                        {drivers.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      ride.driverName
                    )}
                  </td>
                  <td>
                    {ride.kind === "proposed" ? (
                      <select
                        aria-label={`Vehicle for ${ride.studentName}`}
                        value={ride.vehicleId}
                        disabled={busy || stale}
                        onChange={(e) =>
                          onAssignmentChange(
                            ride.id,
                            "vehicleId",
                            e.target.value,
                          )
                        }
                      >
                        {!vehicles.some((v) => v.id === ride.vehicleId) && (
                          <option value={ride.vehicleId}>
                            {ride.vehicleLabel}
                          </option>
                        )}
                        {vehicles
                          .filter((v) => v.status === "active")
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.licensePlate})
                            </option>
                          ))}
                      </select>
                    ) : (
                      ride.vehicleLabel || "—"
                    )}
                  </td>
                  <td>
                    {formatMinutes(ride.start)} @ {ride.pickupName}
                    <small>
                      Window{" "}
                      {formatMinuteRange(
                        ride.pickupWindowStart,
                        ride.pickupWindowEnd,
                      )}
                    </small>
                  </td>
                  <td>
                    {ride.estimatedDropoff != null
                      ? `${formatMinutes(ride.estimatedDropoff)} @ `
                      : ""}
                    {ride.dropoffName}
                    <small>
                      {ride.estimatedDropoff != null
                        ? "Estimated dropoff"
                        : "No dropoff estimate"}
                    </small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
