"use client";

import type { RouteStatus } from "@db/generated/enums";

import { routeStatusLabels } from "@/utils/route-status";
import styles from "./rideStatusChip.module.css";

/**
 * The status pill in the admin rides table. "Requested" and "Scheduled" come
 * straight from the design; the remaining statuses reuse the same palette.
 */
export default function RideStatusChip({ status }: { status: string }) {
  const label =
    routeStatusLabels[status as keyof typeof routeStatusLabels] ?? status;

  return (
    <span className={`${styles.chip} ${styles[toneFor(status)]}`}>{label}</span>
  );
}

type Tone = "requested" | "scheduled" | "complete" | "cancelled" | "missing";

function toneFor(status: string): Tone {
  switch (status as RouteStatus) {
    case "Requested":
      return "requested";
    case "Scheduled":
    case "EnRoute":
    case "Pickedup":
      return "scheduled";
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
