"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import styles from "./dashboard.module.css";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

interface Interval {
  minuteOfDay: number;
  label: string;
  fullLabel: string;
}

export default function PickupDemandHeatmap({
  intervals,
  counts,
}: {
  intervals: Interval[];
  counts: number[][];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [detail, setDetail] = useState<string>();
  const peak = Math.max(0, ...counts.flat());

  function move(
    event: KeyboardEvent<HTMLButtonElement>,
    row: number,
    column: number,
  ) {
    let nextRow = row;
    let nextColumn = column;
    switch (event.key) {
      case "ArrowRight":
        nextColumn += 1;
        break;
      case "ArrowLeft":
        nextColumn -= 1;
        break;
      case "ArrowDown":
        nextRow += 1;
        break;
      case "ArrowUp":
        nextRow -= 1;
        break;
      case "Home":
        nextColumn = 0;
        break;
      case "End":
        nextColumn = intervals.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    nextRow = Math.max(0, Math.min(weekdays.length - 1, nextRow));
    nextColumn = Math.max(0, Math.min(intervals.length - 1, nextColumn));
    ref.current
      ?.querySelector<HTMLButtonElement>(
        `[data-cell="${nextRow * intervals.length + nextColumn}"]`,
      )
      ?.focus();
  }

  return (
    <section
      className={`${styles.panel} ${styles.fullWidthPanel}`}
      aria-labelledby="weekday-demand"
    >
      <div className={styles.breakdownHeader}>
        <div className={styles.panelHeader}>
          <h2 id="weekday-demand" className="text-heading-3">
            Demand by Weekday and Time
          </h2>
          <p>Total rides per 15-minute interval</p>
        </div>
        <div
          className={styles.heatmapLegend}
          aria-label={`Color scale: zero to ${peak} rides`}
        >
          <span>0</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <span
              key={level}
              className={styles.heatmapSwatch}
              data-level={level}
              aria-hidden="true"
            />
          ))}
          <span>{peak.toLocaleString()} rides</span>
        </div>
      </div>
      <div ref={ref} className={styles.heatmapViewport}>
        <table className={styles.heatmap}>
          <caption className="sr-only">
            Scheduled pickup demand across all statuses. Use arrow keys to
            explore time intervals and weekdays.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Weekday</span>
              </th>
              {intervals.map(({ minuteOfDay, label }, column) => (
                <th
                  key={minuteOfDay}
                  scope="col"
                  data-last={column === intervals.length - 1 || undefined}
                >
                  <span
                    className={
                      column % 4 === 0 ? styles.heatmapTime : "sr-only"
                    }
                  >
                    {label.replace(" AM", "a").replace(" PM", "p")}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekdays.map((day, row) => (
              <tr key={day}>
                <th scope="row">{day.slice(0, 3)}</th>
                {intervals.map(({ minuteOfDay, fullLabel }, column) => {
                  const count = counts[row]?.[column] ?? 0;
                  const description = `${day}, ${fullLabel}: ${count.toLocaleString()} ${count === 1 ? "ride" : "rides"}`;
                  const index = row * intervals.length + column;
                  return (
                    <td key={minuteOfDay}>
                      <button
                        type="button"
                        data-cell={index}
                        data-level={
                          count === 0 ? 0 : Math.ceil((count / peak) * 4)
                        }
                        aria-label={description}
                        tabIndex={active === index ? 0 : -1}
                        onMouseEnter={() => setDetail(description)}
                        onFocus={() => {
                          setActive(index);
                          setDetail(description);
                        }}
                        onKeyDown={(event) => move(event, row, column)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.heatmapDetail}>
        {detail ??
          "Hover or focus a cell to see its ride count. Use arrow keys to explore."}
      </p>
    </section>
  );
}
