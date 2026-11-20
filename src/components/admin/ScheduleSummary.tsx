"use client";

import { format } from "date-fns";

import { parseCalendarDate } from "@/utils/dateEst";

import styles from "./schedule.module.css";

interface ScheduleSummaryProps {
  date: string;
  hasPlan: boolean;
  rideCount: number;
  requestedCount: number;
  driverCount: number;
  generatedAt: Date | null;
  generated: boolean;
  loading: boolean;
  generating: boolean;
  busy: boolean;
  isAdmin: boolean;
  onGenerate: () => void;
  onRefresh: () => void;
}

export default function ScheduleSummary({
  date,
  hasPlan,
  rideCount,
  requestedCount,
  driverCount,
  generatedAt,
  generated,
  loading,
  generating,
  busy,
  isAdmin,
  onGenerate,
  onRefresh,
}: ScheduleSummaryProps) {
  return (
    <section className={styles.dayHeader} aria-label="Daily summary">
      <div>
        <h2>{format(parseCalendarDate(date), "EEEE, MMMM d")}</h2>
        <p>
          {hasPlan
            ? `${rideCount} rides · ${requestedCount} ${generated ? "requested" : "need assignments"} · ${driverCount} drivers on shift`
            : loading
              ? "Loading schedule…"
              : "Schedule unavailable"}
        </p>
      </div>
      <div className={styles.generateControls}>
        {generatedAt && (
          <small>Generated at {format(generatedAt, "h:mm a")}</small>
        )}
        <button
          className={styles.btnSecondary}
          disabled={busy || !isAdmin}
          onClick={onGenerate}
        >
          {generating
            ? "Generating…"
            : generated
              ? "Re-generate"
              : "Generate schedule"}
        </button>
        {!generated && (
          <button
            className={styles.iconButton}
            aria-label="Refresh schedule"
            disabled={busy}
            onClick={onRefresh}
          >
            ↻
          </button>
        )}
      </div>
    </section>
  );
}
