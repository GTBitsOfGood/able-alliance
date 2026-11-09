"use client";

import BogButton from "@/components/BogButton/BogButton";
import type { RecurrenceFrequency } from "@/schemas/rideSeries";
import styles from "./styles.module.css";

const DAYS = [
  { label: "M", name: "Monday", weekday: 1 },
  { label: "Tu", name: "Tuesday", weekday: 2 },
  { label: "W", name: "Wednesday", weekday: 3 },
  { label: "Th", name: "Thursday", weekday: 4 },
  { label: "F", name: "Friday", weekday: 5 },
];

export default function RecurrenceFields({
  daysOfWeek,
  endsOn,
  onDaysChange,
  onEndChange,
  minDate,
  frequency,
  onFrequencyChange,
  compact = false,
}: {
  daysOfWeek: number[];
  endsOn: string;
  onDaysChange: (days: number[]) => void;
  onEndChange: (date: string) => void;
  minDate?: string;
  frequency: RecurrenceFrequency;
  onFrequencyChange: (frequency: RecurrenceFrequency) => void;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.fields} ${compact ? styles.compact : ""}`}>
      <label>
        Frequency
        <select
          value={frequency}
          onChange={(event) =>
            onFrequencyChange(event.target.value as RecurrenceFrequency)
          }
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every two weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </label>
      {frequency === "monthly" && minDate && (
        <p className={styles.hint}>
          Repeats on the{" "}
          {
            ["first", "second", "third", "fourth", "fifth"][
              Math.floor((Number(minDate.slice(-2)) - 1) / 7)
            ]
          }{" "}
          occurrence of each selected weekday every month.
          {Number(minDate.slice(-2)) > 28
            ? " Months without a fifth occurrence are skipped."
            : ""}
        </p>
      )}

      <fieldset>
        <legend>Repeats on</legend>
        <div className={styles.dayButtons}>
          {DAYS.map(({ label, name, weekday }) => (
            <BogButton
              key={weekday}
              type="button"
              aria-label={name}
              aria-pressed={daysOfWeek.includes(weekday)}
              className={
                daysOfWeek.includes(weekday) ? styles.selectedDay : styles.day
              }
              onClick={() =>
                onDaysChange(
                  daysOfWeek.includes(weekday)
                    ? daysOfWeek.filter((day) => day !== weekday)
                    : [...daysOfWeek, weekday],
                )
              }
            >
              {label}
            </BogButton>
          ))}
        </div>
      </fieldset>

      <label>
        Ends
        <input
          type="date"
          value={endsOn}
          min={minDate}
          onChange={(event) => onEndChange(event.target.value)}
        />
      </label>
    </div>
  );
}
