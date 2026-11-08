"use client";

import { RouteStatus } from "@db/generated/enums";
import {
  getDriverRideAction,
  driverNoShowAction,
  type DriverRideAction,
} from "@/utils/route-status";
import styles from "./driver-actions.module.css";

/** Shared by the ride list and detail page so action labels and colors match. */
export default function DriverRideActions({
  status,
  onAction,
  busy = false,
  missingBusy = false,
}: {
  status: RouteStatus;
  onAction?: (action: DriverRideAction) => void;
  busy?: boolean;
  missingBusy?: boolean;
}) {
  const action = getDriverRideAction(status);
  if (!action) return null;
  const disabled = !onAction || busy || missingBusy;
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${styles.button} ${action.endpoint === "start" ? styles.neutral : styles.green}`}
        disabled={disabled}
        onClick={() => onAction?.(action)}
      >
        {busy ? action.busyLabel : action.label}
      </button>
      {status === RouteStatus.Arrived && (
        <button
          type="button"
          className={`${styles.button} ${styles.red}`}
          disabled={disabled}
          onClick={() => onAction?.(driverNoShowAction)}
        >
          {missingBusy
            ? driverNoShowAction.busyLabel
            : driverNoShowAction.label}
        </button>
      )}
    </div>
  );
}
