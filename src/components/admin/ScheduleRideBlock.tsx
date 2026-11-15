"use client";

import { useRef } from "react";
import { LockSimpleIcon } from "@phosphor-icons/react";

import { formatMinutes, formatMinuteRange } from "@/utils/rideTiming";
import type { ScheduleRide } from "@/types/autoSchedule";

import styles from "./schedule.module.css";

interface ScheduleRideBlockProps {
  ride: ScheduleRide;
  left: number;
  width: number;
  lane: number;
  disabled: boolean;
  dragging: boolean;
  onDragStart: (rideId: string) => void;
  onDragEnd: () => void;
  onRideClick: (rideId: string) => void;
}

export default function ScheduleRideBlock({
  ride,
  left,
  width,
  lane,
  disabled,
  dragging,
  onDragStart,
  onDragEnd,
  onRideClick,
}: ScheduleRideBlockProps) {
  const suppressRideClick = useRef(false);

  return (
    <button
      aria-describedby={
        ride.kind === "proposed" ? "schedule-drag-help" : undefined
      }
      className={`${styles.ride} ${styles[ride.kind]} ${ride.needsReview && ride.kind !== "unassigned" ? styles.conflict : ""} ${dragging ? styles.dragging : ""}`}
      draggable={ride.kind === "proposed" && !disabled}
      onDragStart={(event) => {
        if (ride.kind !== "proposed" || disabled) {
          event.preventDefault();

          return;
        }

        event.dataTransfer.setData("application/x-able-schedule-ride", ride.id);
        event.dataTransfer.effectAllowed = "move";
        suppressRideClick.current = true;
        onDragStart(ride.id);
      }}
      onDragEnd={() => {
        onDragEnd();
        suppressRideClick.current = false;
      }}
      style={{
        left: `${left}%`,
        width: `${width}%`,
        top: `${lane * 7.2 + 0.4}rem`,
      }}
      onClick={() => {
        if (!suppressRideClick.current) {
          onRideClick(ride.id);
        }
      }}
      title={`${ride.studentName} · ${formatMinuteRange(ride.start, ride.end)} · ${ride.pickupName} → ${ride.dropoffName}${ride.reason ? ` · ${ride.reason}` : ""}`}
      aria-label={`${ride.studentName}, ${formatMinutes(ride.start)}, ${ride.kind === "existing" ? "scheduled" : ride.kind}. View assignment details`}
    >
      <strong>
        {ride.kind === "existing" && <LockSimpleIcon size={12} />}
        {formatMinutes(ride.start)}
      </strong>
      <span>{ride.studentName}</span>
      <small>
        {ride.vehicleLabel ||
          (ride.kind === "unassigned" ? "Unassigned" : "Vehicle pending")}
      </small>
    </button>
  );
}
