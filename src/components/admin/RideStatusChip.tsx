"use client";

import { RouteStatus } from "@db/generated/enums";

import { routeStatusLabels } from "@/utils/route-status";
import styles from "./rideStatusChip.module.css";

/**
 * The status pill in the admin rides table. Requested and Scheduled come
 * straight from the design; the remaining statuses reuse the same palette.
 */
export default function RideStatusChip({ status }: { status: RouteStatus }) {
  const label = routeStatusLabels[status];

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

function toneFor(status: RouteStatus): Tone {
  switch (status) {
    case RouteStatus.ActionRequiredByAdmin:
    case RouteStatus.ActionRequiredByStudent:
      return "actionRequired";
    case RouteStatus.Requested:
      return "requested";
    case RouteStatus.Scheduled:
      return "scheduled";
    case RouteStatus.EnRoute:
    case RouteStatus.Arrived:
    case RouteStatus.Pickedup:
      return "progress";
    case RouteStatus.Completed:
      return "complete";
    case RouteStatus.Missing:
      return "missing";
    case RouteStatus.CancelledByStudent:
    case RouteStatus.CancelledByAdmin:
      return "cancelled";
    default:
      return "cancelled";
  }
}
