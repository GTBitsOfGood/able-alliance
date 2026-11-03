"use client";

import type { RouteStatus } from "@db/generated/enums";

import { routeStatusLabels } from "@/utils/route-status";
import styles from "./rideStatusChip.module.css";

/** Admin terminology from the Sprint 3 ride list. API status names stay stable. */
export function adminStatusLabel(status: string) {
  if (status === "EnRoute") return "Initiated";
  if (status === "Pickedup") return "In-Progress";
  return routeStatusLabels[status as keyof typeof routeStatusLabels] ?? status;
}

/**
 * The status pill in the admin rides table. "Requested" and "Scheduled" come
 * straight from the design; the remaining statuses reuse the same palette.
 */
export default function RideStatusChip({ status }: { status: string }) {
  const label = adminStatusLabel(status);

  return (
    <span className={`${styles.chip} ${styles[toneFor(status)]}`}>{label}</span>
  );
}

type Tone =
  | "actionRequired"
  | "progress"
  | "requested"
  | "scheduled"
  | "complete"
  | "cancelled"
  | "missing";

function toneFor(status: string): Tone {
  switch (status as RouteStatus) {
    case "ActionRequired":
      return "actionRequired";
    case "Requested":
      return "requested";
    case "Scheduled":
      return "scheduled";
    case "EnRoute":
    case "Pickedup":
      return "progress";
    case "Completed":
      return "complete";
    case "Missing":
      return "missing";
    case "CancelledByStudent":
    case "CancelledByAdmin":
      return "cancelled";
    default:
      return "cancelled";
  }
}
