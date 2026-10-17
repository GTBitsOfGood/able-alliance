"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useMeasure } from "react-use";
import BogIcon from "@/components/BogIcon/BogIcon";
import type { AutoSchedulePlan } from "@/server/scheduling/autoSchedule";
import styles from "./styles.module.css";

type BlockKind = "existing" | "proposed" | "unassigned";

type Block = {
  id: string;
  kind: BlockKind;
  start: number;
  end: number;
  label: string;
  title: string;
  conflict?: boolean;
};

type Row = {
  key: string;
  name: string;
  detail: string;
  shifts: { start: number; end: number }[];
  blocks: Block[];
};

const KIND_LABEL: Record<BlockKind, string> = {
  existing: "already booked",
  proposed: "proposed",
  unassigned: "unassigned",
};

// Approximate rendered width of block text, used to keep names from colliding.
const LABEL_CHAR_PX = 6.6;
const LABEL_PADDING_PX = 14;
const FALLBACK_BAR_PX = 800;

function todayEst(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
}

function minLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = String(min % 60).padStart(2, "0");
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

function hourLabel(min: number): string {
  const h = Math.floor(min / 60);
  return `${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`;
}

function shortName(full: string): string {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0];
}

type RideInfo = Omit<AutoSchedulePlan["unassigned"][number], "reason">;

function toBlock(r: RideInfo, kind: BlockKind, extra?: string): Block {
  return {
    id: r.id,
    kind,
    start: r.start,
    end: r.end,
    label: `${minLabel(r.start).replace(/ [AP]M$/, "")} ${shortName(r.studentName)}`,
    title: [
      `${r.studentName} (${KIND_LABEL[kind]})`,
      `${minLabel(r.start)} – ${minLabel(r.end)}`,
      `${r.pickupName} → ${r.dropoffName}`,
      r.vehicleLabel && `Vehicle: ${r.vehicleLabel}`,
      r.accommodations.length > 0 && `Needs: ${r.accommodations.join(", ")}`,
      extra,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

/** Greedily stacks blocks into lanes so no two labels overlap horizontally. */
function layoutLanes(
  blocks: Block[],
  pct: (min: number) => number,
  barPx: number,
) {
  const laneEnds: number[] = [];
  const placed = [...blocks]
    .sort((a, b) => a.start - b.start)
    .map((b) => {
      const left = pct(b.start);
      const labelPct =
        ((b.label.length * LABEL_CHAR_PX + LABEL_PADDING_PX) / barPx) * 100;
      const width = Math.max(pct(b.end) - left, labelPct);
      let lane = laneEnds.findIndex((end) => end <= left);
      if (lane === -1) lane = laneEnds.push(0) - 1;
      laneEnds[lane] = left + width + 0.3;
      return { ...b, left, width, lane };
    });
  return { placed, lanes: Math.max(laneEnds.length, 1) };
}

export default function AutoSchedulePage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const userType = session?.user?.type;
  const isAdmin = userType === "Admin" || userType === "SuperAdmin";

  const [date, setDate] = useState(todayEst);
  const [plan, setPlan] = useState<AutoSchedulePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [axisRef, { width: axisWidth }] = useMeasure<HTMLDivElement>();

  useEffect(() => {
    if (sessionStatus !== "loading" && !isAdmin) router.replace("/");
  }, [sessionStatus, isAdmin, router]);

  async function generate() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const r = await fetch(`/api/routes/auto-schedule?date=${date}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Failed to generate schedule");
      setPlan(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate schedule");
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!plan?.assignments.length) return;
    setApplying(true);
    setError(null);
    try {
      const r = await fetch("/api/routes/auto-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, assignments: plan.assignments }),
      });
      const body = await r.json();
      if (!r.ok && r.status !== 207)
        throw new Error(body.error ?? "Failed to apply schedule");
      const failed = (body.results as { success: boolean }[]).filter(
        (x) => !x.success,
      ).length;
      setPlan(null);
      setNotice(
        failed
          ? `${plan.assignments.length - failed} rides scheduled, ${failed} failed.`
          : `${plan.assignments.length} rides scheduled.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply schedule");
    } finally {
      setApplying(false);
    }
  }

  if (sessionStatus === "loading" || !isAdmin) return null;

  const proposed =
    plan?.drivers.flatMap((d) =>
      d.rides
        .filter((r) => r.kind === "proposed")
        .map((r) => ({ ...r, driverName: d.name })),
    ) ?? [];
  const unassigned = plan?.unassigned ?? [];
  const requestedCount = proposed.length + unassigned.length;
  const doubleBookings = plan?.doubleBookings ?? [];
  const conflictNotes = new Map<string, string[]>();
  for (const db of doubleBookings) {
    const [a, b] = db.rides;
    for (const [self, other] of [
      [a, b],
      [b, a],
    ]) {
      conflictNotes.set(self.id, [
        ...(conflictNotes.get(self.id) ?? []),
        `Double-booked ${db.resource} ${db.name} with ${other.studentName} at ${minLabel(other.start)}`,
      ]);
    }
  }

  const driverRows: Row[] = (plan?.drivers ?? [])
    .map((d) => {
      const booked = d.rides.filter((r) => r.kind === "existing").length;
      const total = d.rides.length;
      return {
        key: d._id,
        name: d.name,
        detail: `${total} ${total === 1 ? "ride" : "rides"}${
          total ? ` · ${booked} booked, ${total - booked} proposed` : ""
        }${d.shifts.length ? "" : " · no shift"}`,
        shifts: d.shifts,
        blocks: d.rides.map((r) => {
          const notes = conflictNotes.get(r.id);
          return {
            ...toBlock(r, r.kind, notes?.join("\n")),
            conflict: !!notes,
          };
        }),
      };
    })
    .sort(
      (a, b) =>
        b.blocks.length - a.blocks.length || a.name.localeCompare(b.name),
    );

  const rows: Row[] = [
    ...(unassigned.length
      ? [
          {
            key: "unassigned",
            name: "Unassigned",
            detail: `${unassigned.length} ${unassigned.length === 1 ? "ride" : "rides"}`,
            shifts: [],
            blocks: unassigned.map((r) =>
              toBlock(r, "unassigned", `Why: ${r.reason}`),
            ),
          },
        ]
      : []),
    ...driverRows,
  ];

  const spans = rows.flatMap((r) => [...r.shifts, ...r.blocks]);
  const windowStart = spans.length
    ? Math.floor(Math.min(...spans.map((b) => b.start)) / 60) * 60
    : 0;
  const windowEnd = spans.length
    ? Math.ceil(Math.max(...spans.map((b) => b.end)) / 60) * 60
    : 0;
  const span = Math.max(windowEnd - windowStart, 60);
  const pct = (min: number) => ((min - windowStart) / span) * 100;
  const hours = Array.from(
    { length: span / 60 + 1 },
    (_, i) => windowStart + i * 60,
  );
  const labelStep = hours.length > 13 ? 2 : 1;
  const barPx = axisWidth || FALLBACK_BAR_PX;

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        Auto-Schedule <span className={styles.experimental}>Experimental</span>
      </h1>

      <div className={styles.controls}>
        <input
          type="date"
          className={styles.dateInput}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setPlan(null);
          }}
        />
        <button
          type="button"
          className={styles.btnSecondary}
          onClick={generate}
          disabled={!date || loading || applying}
        >
          {loading ? "Generating…" : "Generate schedule"}
        </button>
        <button
          type="button"
          className={styles.btnPrimary}
          onClick={apply}
          disabled={!plan?.assignments.length || applying}
        >
          {applying
            ? "Applying…"
            : `Apply ${plan?.assignments.length ?? 0} assignments`}
        </button>
      </div>

      {error && (
        <span className={`${styles.banner} ${styles.bannerError}`}>
          <BogIcon name="warning" size={16} />
          {error}
        </span>
      )}
      {notice && <span className={styles.banner}>{notice}</span>}

      {plan && (
        <>
          <p className={styles.summary}>
            {requestedCount === 0 ? (
              "There are no requested rides on this day."
            ) : (
              <>
                <strong>{requestedCount}</strong> requested{" "}
                {requestedCount === 1 ? "ride" : "rides"} on this day:{" "}
                <strong>{proposed.length}</strong> can be assigned
                {unassigned.length > 0 && (
                  <>
                    , <strong>{unassigned.length}</strong> can&apos;t (see why
                    below)
                  </>
                )}
                . Applying books only the proposed rides.
              </>
            )}
          </p>

          {doubleBookings.length > 0 && (
            <div className={`${styles.sectionCard} ${styles.conflictCard}`}>
              <div className={styles.conflictHeader}>
                <h2 className={styles.sectionTitle}>
                  <BogIcon name="warning" size={18} /> Existing double-bookings
                  ({doubleBookings.length})
                </h2>
                <p className={styles.conflictHint}>
                  These rides were booked outside auto-schedule and overlap once
                  travel and turnaround time are included. New proposals avoid
                  them, but they need to be reassigned by hand.
                </p>
              </div>

              <ul className={styles.conflictList}>
                {doubleBookings.map((db) => (
                  <li
                    key={`${db.resource}-${db.rides[0].id}-${db.rides[1].id}`}
                  >
                    <strong>{db.name}</strong> ({db.resource}):{" "}
                    {db.rides[0].studentName} {minLabel(db.rides[0].start)}–
                    {minLabel(db.rides[0].end)} overlaps{" "}
                    {db.rides[1].studentName} at {minLabel(db.rides[1].start)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={styles.sectionCard}>
            <div className={styles.legend}>
              <span>
                <i className={styles.swatchShift} /> On shift
              </span>
              <span>
                <i className={styles.swatchExisting} /> Already booked
              </span>
              <span>
                <i className={styles.swatchProposed} /> Proposed
              </span>
              {unassigned.length > 0 && (
                <span>
                  <i className={styles.swatchUnassigned} /> Unassigned
                </span>
              )}
              {doubleBookings.length > 0 && (
                <span>
                  <i className={styles.swatchConflict} /> Double-booked
                </span>
              )}
            </div>

            {rows.length === 0 ? (
              <p className={styles.empty}>
                No drivers have shifts on this day.
              </p>
            ) : (
              <div className={styles.timeline}>
                <div className={styles.row}>
                  <span />
                  <div ref={axisRef} className={styles.hourLabels}>
                    {hours.map((h, i) =>
                      i % labelStep === 0 ? (
                        <span
                          key={h}
                          style={{
                            left: `${pct(h)}%`,
                            transform: `translateX(${
                              i === 0 ? 0 : h === windowEnd ? -100 : -50
                            }%)`,
                          }}
                        >
                          {hourLabel(h)}
                        </span>
                      ) : null,
                    )}
                  </div>
                </div>
                {rows.map((row) => {
                  const { placed, lanes } = layoutLanes(row.blocks, pct, barPx);
                  return (
                    <div key={row.key} className={styles.row}>
                      <span
                        className={`${styles.driverName} ${
                          row.key === "unassigned" ? styles.unassignedName : ""
                        }`}
                      >
                        {row.name}
                        <small className={styles.rowDetail}>{row.detail}</small>
                      </span>
                      <div
                        className={styles.bar}
                        style={{ height: `${lanes * 2.8 + 0.4}rem` }}
                      >
                        {row.shifts.map((s) => (
                          <div
                            key={s.start}
                            className={styles.shift}
                            style={{
                              left: `${pct(s.start)}%`,
                              width: `${pct(s.end) - pct(s.start)}%`,
                            }}
                          />
                        ))}
                        {hours.slice(1, -1).map((h) => (
                          <div
                            key={h}
                            className={styles.hourMark}
                            style={{ left: `${pct(h)}%` }}
                          />
                        ))}
                        {hours.slice(0, -1).map((h) => (
                          <div
                            key={`${h}-half`}
                            className={styles.halfHourMark}
                            style={{ left: `${pct(h + 30)}%` }}
                          />
                        ))}
                        {placed.map((b) => (
                          <div
                            key={b.id}
                            title={b.title}
                            className={`${styles.ride} ${styles[`ride_${b.kind}`]} ${
                              b.conflict ? styles.rideConflict : ""
                            }`}
                            style={{
                              left: `${b.left}%`,
                              width: `${b.width}%`,
                              top: `${0.4 + b.lane * 2.8}rem`,
                            }}
                          >
                            {b.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {proposed.length > 0 && (
            <div className={`${styles.sectionCard} ${styles.proposedCard}`}>
              <h2 className={styles.sectionTitle}>
                <i className={styles.swatchProposed} /> Proposed assignments (
                {proposed.length})
              </h2>
              <table className={`${styles.table} ${styles.proposedTable}`}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Pickup</th>
                    <th>Dropoff</th>
                    <th>Driver</th>
                    <th>Vehicle</th>
                  </tr>
                </thead>
                <tbody>
                  {proposed.map((r) => (
                    <tr key={r.id}>
                      <td>{r.studentName}</td>
                      <td>
                        {minLabel(r.start)} @ {r.pickupName}
                      </td>
                      <td>{r.dropoffName}</td>
                      <td>{r.driverName}</td>
                      <td>{r.vehicleLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {unassigned.length > 0 && (
            <div className={`${styles.sectionCard} ${styles.unassignedCard}`}>
              <h2 className={styles.sectionTitle}>
                <i className={styles.swatchUnassigned} /> Can&apos;t be assigned
                ({unassigned.length})
              </h2>
              <table className={`${styles.table} ${styles.unassignedTable}`}>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Pickup</th>
                    <th>Dropoff</th>
                    <th>Accommodations</th>
                    <th>Why</th>
                  </tr>
                </thead>
                <tbody>
                  {unassigned.map((r) => (
                    <tr key={r.id}>
                      <td>{r.studentName}</td>
                      <td>
                        {minLabel(r.start)} @ {r.pickupName}
                      </td>
                      <td>{r.dropoffName}</td>
                      <td>{r.accommodations.join(", ") || "—"}</td>
                      <td>{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
