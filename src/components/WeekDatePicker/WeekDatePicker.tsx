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
import { estDateKey, estWeekRange, parseCalendarDate } from "@/utils/dateEst";

import styles from "./styles.module.css";

export default function WeekDatePicker({
  weekOffset,
  onWeekChange,
  ready,
  disabled = false,
  selectedDate,
  onDateChange,
  allowPastWeeks = false,
  appearance = "week",
}: {
  appearance?: "week" | "date";
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  ready: boolean;
  disabled?: boolean;
  /** Enable exact weekday selection while retaining the shared week navigator. */
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  /** Admins can inspect previous schedules; rider/driver lists stay current or future. */
  allowPastWeeks?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const currentWeek = parseCalendarDate(estDateKey(estWeekRange(0)[0]));
  const selectedWeek = parseCalendarDate(
    estDateKey(estWeekRange(weekOffset)[0]),
  );
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
  const selectedDay = selectedDate ? parseCalendarDate(selectedDate) : monday;
  let fallbackDay = isSameMonth(selectedDay, month)
    ? selectedDay
    : allowPastWeeks
      ? startOfMonth(month)
      : firstEnabledDate;
  if (onDateChange) {
    while (fallbackDay.getDay() === 0 || fallbackDay.getDay() === 6)
      fallbackDay = addDays(fallbackDay, 1);
  }
  const tabStop = focusKey ?? format(fallbackDay, "yyyy-MM-dd");

  useEffect(() => {
    if (focusKey) dateButtons.current.get(focusKey)?.focus();
  }, [focusKey]);

  function selectWeek(offset: number) {
    const targetOffset = allowPastWeeks ? offset : Math.max(0, offset);
    if (onDateChange) {
      const targetMonday = addDays(currentWeek, targetOffset * 7 + 1);
      onDateChange(format(targetMonday, "yyyy-MM-dd"));
    } else onWeekChange(targetOffset);
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
    if (onDateChange && (target.getDay() === 0 || target.getDay() === 6)) {
      target = addDays(
        target,
        event.key === "ArrowLeft" || event.key === "End" ? -1 : 1,
      );
      if (target.getDay() === 0 || target.getDay() === 6)
        target = addDays(
          target,
          event.key === "ArrowLeft" || event.key === "End" ? -1 : 1,
        );
    }
    if (!allowPastWeeks && differenceInCalendarWeeks(target, currentWeek) < 0)
      return;
    setMonth(startOfMonth(target));
    setFocusKey(format(target, "yyyy-MM-dd"));
  }

  return (
    <nav
      className={
        appearance === "date" ? styles.datePicker : styles.weekNavigator
      }
      aria-label={
        appearance === "date"
          ? "Schedule date"
          : onDateChange
            ? "Browse schedule by week"
            : "Browse rides by week"
      }
    >
      {appearance === "week" ? (
        <button
          type="button"
          className={styles.weekButton}
          aria-label="Previous week"
          disabled={!ready || disabled || (!allowPastWeeks && weekOffset === 0)}
          onClick={() =>
            onWeekChange(
              allowPastWeeks ? weekOffset - 1 : Math.max(0, weekOffset - 1),
            )
          }
        >
          <BogIcon name="chevron-left" size={32} />
        </button>
      ) : (
        <span>Date</span>
      )}
      <Popover.Root
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            setMonth(startOfMonth(selectedDay));
            setFocusKey(null);
          }
          setOpen(nextOpen);
        }}
      >
        <Popover.Trigger asChild>
          <button
            type="button"
            className={
              appearance === "date" ? styles.dateTrigger : styles.weekLabel
            }
            disabled={!ready || disabled}
            aria-label={
              appearance === "date"
                ? `Choose schedule date, ${format(selectedDay, "MMMM d, yyyy")}`
                : ready
                  ? `Choose week, ${rangeLabel}`
                  : "Choose week"
            }
          >
            {appearance === "date" ? (
              <>
                <span>{format(selectedDay, "MM/dd/yy")}</span>
                <BogIcon name="calendar" size={18} weight="regular" />
              </>
            ) : (
              <>
                <span>Week of</span>
                <span
                  className={styles.weekDates}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {ready ? rangeLabel : "Loading…"}
                </span>
              </>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className={styles.calendar}
            side="bottom"
            align={appearance === "date" ? "end" : "center"}
            sideOffset={8}
            collisionPadding={16}
            aria-label={
              onDateChange ? "Choose a schedule date" : "Choose a week"
            }
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              dateButtons.current.get(tabStop)?.focus();
            }}
          >
            <div className={styles.calendarHeader}>
              <button
                type="button"
                className={styles.calendarArrow}
                aria-label="Previous month"
                disabled={
                  !allowPastWeeks &&
                  startOfMonth(month) <= startOfMonth(currentWeek)
                }
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
                      const dateDisabled =
                        disabled ||
                        !isSameMonth(date, month) ||
                        (!allowPastWeeks && offset < 0) ||
                        (!!onDateChange && (column === 0 || column === 6));
                      const selected = onDateChange
                        ? key === selectedDate
                        : offset === weekOffset && column >= 1 && column <= 5;
                      return (
                        <td
                          key={key}
                          role="gridcell"
                          aria-selected={selected}
                          className={
                            selected && !onDateChange
                              ? styles.selectedWeekDay
                              : undefined
                          }
                        >
                          <button
                            type="button"
                            ref={(element) => {
                              if (element)
                                dateButtons.current.set(key, element);
                              else dateButtons.current.delete(key);
                            }}
                            disabled={dateDisabled}
                            tabIndex={key === tabStop ? 0 : -1}
                            aria-label={format(date, "EEEE, MMMM d, yyyy")}
                            className={
                              selected &&
                              (onDateChange || column === 1 || column === 5)
                                ? styles.weekEndpoint
                                : undefined
                            }
                            onClick={() => {
                              if (onDateChange) {
                                onDateChange(key);
                                setOpen(false);
                              } else selectWeek(offset);
                            }}
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
      {appearance === "week" && (
        <button
          type="button"
          className={styles.weekButton}
          aria-label="Next week"
          disabled={!ready || disabled}
          onClick={() => onWeekChange(weekOffset + 1)}
        >
          <BogIcon name="chevron-right" size={32} />
        </button>
      )}
    </nav>
  );
}
