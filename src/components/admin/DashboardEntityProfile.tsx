"use client";

import type { CSSProperties, Ref } from "react";

import {
  dashboardRideStatuses,
  type DashboardBreakdown,
} from "@/hooks/useStatistics";

import styles from "./dashboard.module.css";

type Activity = Exclude<DashboardBreakdown, { section: "locations" }>;

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const entityNames = {
  students: "Student",
  drivers: "Driver",
  vehicles: "Vehicle",
};

export default function DashboardEntityProfile({
  activity,
  selectedId,
  onSelect,
  profileRef,
  onClose,
}: {
  activity: Activity;
  selectedId: string;
  onSelect: (id: string) => void;
  profileRef: Ref<HTMLElement>;
  onClose?: () => void;
}) {
  const { section, rows } = activity;
  const entity = rows.find(({ id }) => id === selectedId) ?? rows[0];
  const name = entityNames[section];
  const students = section === "students";

  const segments =
    section !== "vehicles"
      ? dashboardRideStatuses.map(({ statuses, label, color }) => ({
          label,
          count: statuses.reduce(
            (total, status) => total + entity.statuses[status],
            0,
          ),
          color: `var(${color})`,
        }))
      : [
          {
            label: "Completed",
            count: entity.completed,
            color: "var(--chart-completed)",
          },
          {
            label: "Other assignments",
            count: entity.total - entity.completed,
            color: "var(--chart-open)",
          },
        ];
  const metrics = students
    ? [
        {
          label: "Rides with reported delays",
          value: number.format(entity.delayed),
        },
        {
          label: "Average reported delay",
          value: entity.delayed
            ? `${number.format(entity.delayMinutes / entity.delayed)} min`
            : "—",
        },
      ]
    : [
        {
          label: "Days with completions",
          value: number.format(entity.completedDays),
        },
        {
          label:
            section === "drivers"
              ? "Unique students served"
              : "Drivers who completed rides",
          value: number.format(entity.completedParticipants),
        },
      ];

  return (
    <section
      ref={profileRef}
      className={styles.panel}
      aria-labelledby="entity-profile"
    >
      <div className={styles.breakdownHeader}>
        <div className={styles.panelHeader}>
          <h2 id="entity-profile" className="text-heading-3">
            {section === "drivers" ? entity.name : `${name} activity`}
          </h2>
          <p>
            {number.format(entity.total)}{" "}
            {students ? "rides" : "assigned rides"} for {entity.name}
          </p>
        </div>
        {section === "drivers" ? (
          <button type="button" className={styles.manageLink} onClick={onClose}>
            Close details
          </button>
        ) : (
          <label className={styles.profilePicker}>
            {name}
            <select
              value={entity.id}
              onChange={(event) => onSelect(event.target.value)}
            >
              {rows.map(({ id, name, detail }) => (
                <option key={id} value={id}>
                  {detail ? `${name} (${detail})` : name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {entity.total > 0 && (
        <div className={styles.profileBar} aria-hidden="true">
          {segments
            .filter(({ count }) => count > 0)
            .map(({ label, count, color }) => (
              <span
                key={label}
                style={{ flexGrow: count, backgroundColor: color }}
              />
            ))}
        </div>
      )}
      <dl className={styles.profileLegend} aria-label="Ride outcomes">
        {segments.map(({ label, count, color }) => (
          <div key={label} style={{ "--swatch": color } as CSSProperties}>
            <dt>{label}</dt>
            <dd>{number.format(count)}</dd>
          </div>
        ))}
      </dl>

      <dl
        className={styles.profileMetrics}
        aria-label={students ? "Reported delays" : "Completed ride activity"}
      >
        {metrics.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
