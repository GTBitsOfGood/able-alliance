"use client";

import { useState } from "react";
import { LockSimpleIcon } from "@phosphor-icons/react";

import { MINUTES_PER_DAY } from "@/utils/dateEst";
import {
  formatMinutes,
  formatMinuteRange,
  SERVICE_START_MINUTES,
  SERVICE_END_MINUTES,
} from "@/utils/rideTiming";
import type { AutoSchedulePlan, ScheduleRide } from "@/types/autoSchedule";

import ScheduleRideBlock from "./ScheduleRideBlock";
import styles from "./schedule.module.css";

interface ScheduleTimelineProps {
  drivers: AutoSchedulePlan["drivers"];
  rideRows: ScheduleRide[];
  generated: boolean;
  proposedCount: number;
  unassignedCount: number;
  busy: boolean;
  stale: boolean;
  validating: boolean;
  onReassign: (rideId: string, driverId: string) => Promise<void>;
  onRideClick: (rideId: string) => void;
}

export default function ScheduleTimeline({
  drivers,
  rideRows,
  generated,
  proposedCount,
  unassignedCount,
  busy,
  stale,
  validating,
  onReassign,
  onRideClick,
}: ScheduleTimelineProps) {
  const [draggedRideId, setDraggedRideId] = useState<string | null>(null);
  const [dropDriverId, setDropDriverId] = useState<string | null>(null);
  const spans = [...drivers.flatMap((d) => d.shifts), ...rideRows];
  const start = Math.min(
    SERVICE_START_MINUTES,
    ...spans.map((s) => Math.max(0, Math.floor(s.start / 60) * 60)),
  );
  const end = Math.max(
    SERVICE_END_MINUTES,
    ...spans.map((s) => Math.min(MINUTES_PER_DAY, Math.ceil(s.end / 60) * 60)),
  );
  const duration = end - start;
  const pct = (minute: number) =>
    ((Math.max(start, Math.min(end, minute)) - start) / duration) * 100;
  const firstHour = Math.ceil(start / 60) * 60;
  const hours = [
    ...(start < firstHour ? [start] : []),
    ...Array.from(
      { length: Math.ceil((end - firstHour) / 60) },
      (_, i) => firstHour + i * 60,
    ),
  ];

  function endDrag() {
    setDraggedRideId(null);
    setDropDriverId(null);
  }

  return (
    <section className={styles.section} aria-label="Driver schedule">
      <div className={styles.sectionHeader}>
        <h3>{generated ? "Proposed Schedule" : "Daily Schedule"}</h3>
        <div className={styles.legend}>
          <span>
            <i className={styles.scheduledSwatch} />
            <LockSimpleIcon size={12} /> Scheduled
          </span>
          <span>
            <i className={styles.proposedSwatch} /> Proposed
          </span>
          <span>
            <i className={styles.offShiftSwatch} /> Off shift
          </span>
        </div>
      </div>
      <p className={styles.dragStatus} role="status" aria-live="polite">
        {validating
          ? "Checking shifts, travel time, ride conflicts, and vehicle requirements…"
          : draggedRideId
            ? "Drop on a driver row. The pickup time will stay the same."
            : ""}
      </p>
      {!drivers.length && !unassignedCount ? (
        <p className={styles.empty}>No rides or driver shifts on this day.</p>
      ) : (
        <div
          className={styles.timelineScroll}
          tabIndex={0}
          role="region"
          aria-label="Scrollable driver timeline"
        >
          <div
            className={styles.timeline}
            style={{ minWidth: `${18 + (duration / 60) * 13}rem` }}
          >
            <div className={styles.timelineRow}>
              <div className={styles.axisDriver}>Driver</div>
              <div className={styles.axis}>
                {hours.map((h) => (
                  <span key={h} style={{ left: `${pct(h)}%` }}>
                    {formatMinutes(h)}
                  </span>
                ))}
              </div>
            </div>
            {[
              ...drivers.map((d) => ({
                id: d._id,
                name: d.name,
                shifts: d.shifts,
              })),
              ...(unassignedCount
                ? [{ id: "unassigned", name: "Unassigned", shifts: [] }]
                : []),
            ].map((driver) => {
              const rides = rideRows.filter((r) =>
                driver.id === "unassigned"
                  ? r.kind === "unassigned"
                  : r.kind !== "unassigned" && r.driverId === driver.id,
              );
              const laneEnds: number[] = [];
              const blocks = rides.map((ride) => {
                const left = pct(ride.start);
                const width = Math.min(
                  100 - left,
                  Math.max(
                    pct(ride.end) - left,
                    (100 * 88) / ((duration / 60) * 130),
                  ),
                );
                let lane = laneEnds.findIndex((laneEnd) => laneEnd <= left);
                if (lane < 0) {
                  lane = laneEnds.push(0) - 1;
                }

                laneEnds[lane] = left + width + 0.2;

                return { ride, left, width, lane };
              });

              return (
                <div
                  key={driver.id}
                  role="group"
                  aria-label={`Schedule for ${driver.name}`}
                  data-driver-id={driver.id}
                  className={`${styles.timelineRow} ${dropDriverId === driver.id ? styles.dropTarget : ""}`}
                  onDragOver={(event) => {
                    if (
                      busy ||
                      stale ||
                      !draggedRideId ||
                      driver.id === "unassigned"
                    ) {
                      return;
                    }

                    const source = rideRows.find(
                      (ride) => ride.id === draggedRideId,
                    );

                    if (!source || source.driverId === driver.id) {
                      return;
                    }

                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropDriverId(driver.id);
                  }}
                  onDragLeave={(event) => {
                    if (
                      !(event.relatedTarget instanceof Node) ||
                      !event.currentTarget.contains(event.relatedTarget)
                    ) {
                      setDropDriverId((current) =>
                        current === driver.id ? null : current,
                      );
                    }
                  }}
                  onDrop={(event) => {
                    if (!draggedRideId || driver.id === "unassigned") {
                      return;
                    }

                    event.preventDefault();
                    const id = event.dataTransfer.getData(
                      "application/x-able-schedule-ride",
                    );

                    if (id === draggedRideId) {
                      void onReassign(id, driver.id);
                    }

                    endDrag();
                  }}
                >
                  <div className={styles.driver}>
                    <strong>{driver.name}</strong>
                    <small>
                      {driver.shifts.length
                        ? driver.shifts
                            .map((s) => formatMinuteRange(s.start, s.end))
                            .join(", ")
                        : driver.id === "unassigned"
                          ? `${rides.length} awaiting assignment`
                          : "No shift today"}
                    </small>
                  </div>
                  <div
                    className={`${styles.track} ${driver.id === "unassigned" ? styles.unassignedTrack : ""}`}
                    style={{
                      height: `${Math.max(1, laneEnds.length) * 7.2}rem`,
                      backgroundSize: `${(100 * 60) / duration}% 100%`,
                    }}
                  >
                    {driver.id !== "unassigned" && (
                      <span className={styles.offShiftLabel}>Off shift</span>
                    )}
                    {driver.shifts.map((shift) => (
                      <div
                        key={shift.start}
                        className={styles.shift}
                        style={{
                          left: `${pct(shift.start)}%`,
                          width: `${pct(shift.end) - pct(shift.start)}%`,
                        }}
                      />
                    ))}
                    {blocks.map(({ ride, left, width, lane }) => (
                      <ScheduleRideBlock
                        key={ride.id}
                        ride={ride}
                        left={left}
                        width={width}
                        lane={lane}
                        disabled={busy || stale || !generated}
                        dragging={draggedRideId === ride.id}
                        onDragStart={setDraggedRideId}
                        onDragEnd={endDrag}
                        onRideClick={onRideClick}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
