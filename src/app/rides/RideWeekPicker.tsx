"use client";

import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";
import {
  addDays,
  addMonths,
  differenceInCalendarWeeks,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import BogIcon from "@/components/BogIcon/BogIcon";
import { estDateKey, estWeekRange } from "@/utils/dateEst";
import styles from "./student-rides.module.css";

// Calendar arithmetic uses New York calendar dates, independent of browser TZ.
function calendarDate(date: Date) {
  const [year, month, day] = estDateKey(date).split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export default function RideWeekPicker({
  weekOffset,
  onWeekChange,
  ready,
}: {
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  ready: boolean;
}) {
  const [open, setOpen] = useState(false);
  const currentWeek = calendarDate(estWeekRange(0)[0]);
  const selectedWeek = calendarDate(estWeekRange(weekOffset)[0]);
  const monday = addDays(selectedWeek, 1);
  const friday = addDays(selectedWeek, 5);
  const [month, setMonth] = useState(() => startOfMonth(monday));
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const dateButtons = useRef(new Map<string, HTMLButtonElement>());
  const firstDay = startOfWeek(startOfMonth(month));
  const lastDay = endOfWeek(
    new Date(month.getFullYear(), month.getMonth() + 1, 0),
  );
  const weekCount = differenceInCalendarWeeks(lastDay, firstDay) + 1;
  const monthLabel = format(month, "MMMM yyyy");
  const rangeFormat =
    monday.getFullYear() === friday.getFullYear() ? "MMMM d" : "MMMM d, yyyy";
  const rangeLabel = `${format(monday, rangeFormat)} - ${format(friday, rangeFormat)}`;
  const firstEnabledDate =
    startOfMonth(month) < currentWeek ? currentWeek : startOfMonth(month);
  const tabStop =
    focusKey ??
    format(
      isSameMonth(monday, month) ? monday : firstEnabledDate,
      "yyyy-MM-dd",
    );

  useEffect(() => {
    if (focusKey) dateButtons.current.get(focusKey)?.focus();
  }, [focusKey]);

  function selectWeek(offset: number) {
    onWeekChange(Math.max(0, offset));
    setOpen(false);
  }

  function moveFocus(event: React.KeyboardEvent, date: Date) {
    let target: Date;
    switch (event.key) {
      case "ArrowLeft":
        target = addDays(date, -1);
        break;
      case "ArrowRight":
        target = addDays(date, 1);
        break;
      case "ArrowUp":
        target = addDays(date, -7);
        break;
      case "ArrowDown":
        target = addDays(date, 7);
        break;
      case "Home":
        target = startOfWeek(date);
        break;
      case "End":
        target = endOfWeek(date);
        break;
      case "PageUp":
        target = addMonths(date, -1);
        break;
      case "PageDown":
        target = addMonths(date, 1);
        break;
      default:
        return;
    }
    event.preventDefault();
    if (differenceInCalendarWeeks(target, currentWeek) < 0) return;
    setMonth(startOfMonth(target));
    setFocusKey(format(target, "yyyy-MM-dd"));
  }

  return (
    <nav className={styles.weekNavigator} aria-label="Browse rides by week">
      <button
        type="button"
        className={styles.weekButton}
        aria-label="Previous week"
        disabled={!ready || weekOffset === 0}
        onClick={() => onWeekChange(Math.max(0, weekOffset - 1))}
      >
        <BogIcon name="chevron-left" size={32} />
      </button>
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setMonth(startOfMonth(monday));
            setFocusKey(null);
          }
          setOpen(nextOpen);
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={styles.weekLabel}
            disabled={!ready}
            aria-label={ready ? `Choose week, ${rangeLabel}` : "Choose week"}
          >
            <span>Week of</span>
            <span
              className={styles.weekDates}
              aria-live="polite"
              aria-atomic="true"
            >
              {ready ? rangeLabel : "Loading…"}
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={styles.calendar}
            side="bottom"
            align="center"
            sideOffset={8}
            collisionPadding={16}
            aria-label="Choose a week"
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              dateButtons.current.get(format(monday, "yyyy-MM-dd"))?.focus();
            }}
          >
            <div className={styles.calendarHeader}>
              <button
                type="button"
                className={styles.calendarArrow}
                aria-label="Previous month"
                disabled={startOfMonth(month) <= startOfMonth(currentWeek)}
                onClick={() => {
                  setMonth(addMonths(month, -1));
                  setFocusKey(null);
                }}
              >
                <BogIcon name="chevron-left" size={24} />
              </button>
              <span aria-live="polite" className={styles.calendarMonth}>
                {monthLabel}
              </span>
              <button
                type="button"
                className={styles.calendarArrow}
                aria-label="Next month"
                onClick={() => {
                  setMonth(addMonths(month, 1));
                  setFocusKey(null);
                }}
              >
                <BogIcon name="chevron-right" size={24} />
              </button>
            </div>
            <table
              className={styles.calendarGrid}
              role="grid"
              aria-label={monthLabel}
            >
              <thead>
                <tr>
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                    <th key={day} scope="col">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: weekCount }, (_, row) => (
                  <tr key={row}>
                    {Array.from({ length: 7 }, (_, column) => {
                      const date = addDays(firstDay, row * 7 + column);
                      const key = format(date, "yyyy-MM-dd");
                      const offset = differenceInCalendarWeeks(
                        date,
                        currentWeek,
                      );
                      const disabled = !isSameMonth(date, month) || offset < 0;
                      const selected =
                        offset === weekOffset && column >= 1 && column <= 5;
                      return (
                        <td
                          key={key}
                          role="gridcell"
                          aria-selected={selected}
                          className={
                            selected ? styles.selectedWeekDay : undefined
                          }
                        >
                          <button
                            type="button"
                            ref={(element) => {
                              if (element)
                                dateButtons.current.set(key, element);
                              else dateButtons.current.delete(key);
                            }}
                            disabled={disabled}
                            tabIndex={key === tabStop ? 0 : -1}
                            aria-label={format(date, "EEEE, MMMM d, yyyy")}
                            className={
                              selected && (column === 1 || column === 5)
                                ? styles.weekEndpoint
                                : undefined
                            }
                            onClick={() => selectWeek(offset)}
                            onKeyDown={(event) => moveFocus(event, date)}
                          >
                            {date.getDate()}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={styles.calendarShortcuts}>
              <button type="button" onClick={() => selectWeek(0)}>
                This week
              </button>
              <button type="button" onClick={() => selectWeek(1)}>
                Next week
              </button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <button
        type="button"
        className={styles.weekButton}
        aria-label="Next week"
        disabled={!ready}
        onClick={() => onWeekChange(weekOffset + 1)}
      >
        <BogIcon name="chevron-right" size={32} />
      </button>
    </nav>
  );
}
