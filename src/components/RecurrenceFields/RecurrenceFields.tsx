"use client";

import BogButton from "@/components/BogButton/BogButton";
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
  compact = false,
}: {
  daysOfWeek: number[];
  endsOn: string;
  onDaysChange: (days: number[]) => void;
  onEndChange: (date: string) => void;
  minDate?: string;
  compact?: boolean;
}) {
  return (
    <div className={`${styles.fields} ${compact ? styles.compact : ""}`}>
      <label>
        Frequency
        <select value="weekly" onChange={() => {}}>
          <option value="weekly">Weekly</option>
        </select>
      </label>

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
