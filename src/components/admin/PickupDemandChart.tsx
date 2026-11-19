"use client";

import { useState, type Ref } from "react";

import { pickupDemandHours } from "@/hooks/useStatistics";
import {
  formatMinuteRange,
  SERVICE_END_MINUTES,
  SERVICE_START_MINUTES,
} from "@/utils/rideTiming";

import DashboardChart from "./DashboardChart";
import styles from "./dashboard.module.css";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const number = new Intl.NumberFormat("en-US");
const intervalList = new Intl.ListFormat("en-US", { type: "conjunction" });

interface PickupLocation {
  id: string;
  name: string;
  pickups: number;
  dropoffs: number;
  pickupRiders: number;
  pickupDemand: number[][];
}

export default function PickupDemandChart({
  locations,
  selectedId,
  onSelect,
  profileRef,
}: {
  locations: PickupLocation[];
  selectedId: string;
  onSelect: (id: string) => void;
  profileRef: Ref<HTMLElement>;
}) {
  const [weekday, setWeekday] = useState<number>();
  const location =
    locations.find(({ id }) => id === selectedId) ?? locations[0];
  const dayPeaks = location.pickupDemand.map((counts) => Math.max(...counts));
  const selectedDay = weekday ?? dayPeaks.indexOf(Math.max(...dayPeaks));
  const points = location.pickupDemand[selectedDay].map((count, index) => {
    const hour = pickupDemandHours[index];
    const minuteOfDay = Math.max(hour, SERVICE_START_MINUTES);
    return {
      minuteOfDay,
      label: formatMinuteRange(
        minuteOfDay,
        Math.min(hour + 60, SERVICE_END_MINUTES),
      ),
      count,
    };
  });
  const peak = dayPeaks[selectedDay];
  const peaks = points.filter(({ count }) => count === peak);
  const metrics = [
    { label: "Pickups", value: location.pickups },
    { label: "Drop-offs", value: location.dropoffs },
    { label: "Unique pickup riders", value: location.pickupRiders },
  ];

  return (
    <section
      ref={profileRef}
      className={styles.panel}
      aria-labelledby="pickup-demand"
    >
      <div className={styles.breakdownHeader}>
        <div className={styles.panelHeader}>
          <h2 id="pickup-demand" className="text-heading-3">
            Pickup demand
          </h2>
          <p>
            Unique students by weekday and hour (Eastern time). Includes
            completed and open rides.
          </p>
        </div>
        <label className={styles.profilePicker}>
          Location
          <select
            value={location.id}
            onChange={(event) => onSelect(event.target.value)}
          >
            {locations.map(({ id, name }) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div
        className={styles.weekdayButtons}
        role="group"
        aria-label="Pickup weekday"
      >
        {weekdays.map((day, index) => (
          <button
            type="button"
            key={day}
            aria-pressed={index === selectedDay}
            onClick={() => setWeekday(index)}
          >
            <span className="sr-only">{day}</span>
            <span aria-hidden="true">{day.slice(0, 3)}</span>
          </button>
        ))}
      </div>

      {peak > 0 ? (
        <>
          <DashboardChart variant="hours" points={points} measure="Students" />
          <p className={styles.chartNote} aria-live="polite">
            {peaks.length <= 3
              ? `Peak at ${intervalList.format(peaks.map(({ label }) => label))} · `
              : `Peak across ${number.format(peaks.length)} intervals · `}
            {number.format(peak)} {peak === 1 ? "student" : "students"}
            {peaks.length > 1 && " per interval"}
          </p>
        </>
      ) : (
        <p className={styles.chartNote} role="status">
          No pickup demand on {weekdays[selectedDay]}.
        </p>
      )}

      <dl
        className={styles.profileMetrics}
        aria-label="Location totals for the selected date range"
      >
        {metrics.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{number.format(value)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
