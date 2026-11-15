"use client";

import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";

import styles from "./schedule.module.css";

interface ScheduleApplyBarProps {
  assignmentCount: number;
  unassignedCount: number;
  edited: boolean;
  busy: boolean;
  stale: boolean;
  applying: boolean;
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  apply: () => Promise<void>;
}

export default function ScheduleApplyBar({
  assignmentCount,
  unassignedCount,
  edited,
  busy,
  stale,
  applying,
  confirmOpen,
  setConfirmOpen,
  apply,
}: ScheduleApplyBarProps) {
  return (
    <>
      <footer className={styles.applyBar}>
        <p>
          Applies only the {assignmentCount} proposed{" "}
          {assignmentCount === 1 ? "ride" : "rides"}.
          {unassignedCount > 0 &&
            ` ${unassignedCount} unassigned ${unassignedCount === 1 ? "ride stays" : "rides stay"} in Rides.`}
        </p>
        <span>
          {edited
            ? "You have unsaved changes"
            : "Proposed assignments are not booked"}
        </span>
        <button
          className={styles.btnPrimary}
          disabled={busy || stale || !assignmentCount}
          onClick={() => setConfirmOpen(true)}
        >
          Apply {assignmentCount} assignments
        </button>
      </footer>
      <ConfirmActionModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={apply}
        title={`Apply ${assignmentCount} assignments?`}
        description="These proposed rides will be booked. Students and drivers will be notified according to their settings. Existing bookings will be kept."
        confirmLabel={`Apply ${assignmentCount} assignments`}
        confirmingLabel="Applying…"
        cancelLabel="Keep reviewing"
        variant="primary"
        confirming={applying}
        confirmDisabled={stale}
      />
    </>
  );
}
