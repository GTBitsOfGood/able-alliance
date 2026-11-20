"use client";

import { useEffect, useRef, useState } from "react";
import {
  addDays,
  differenceInCalendarDays,
  isSameDay,
  addMonths,
  addYears,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Popover } from "radix-ui";

import BogIcon from "@/components/BogIcon/BogIcon";
import styles from "./DatePickerModal.module.css";

export type DatePickerMode = "week" | "date" | "month" | "year";

interface DatePickerModalProps {
  mode: DatePickerMode;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
  minDate?: Date;
  maxDate?: Date;
  disableWeekends?: boolean;
  shortcuts: { label: string; date: Date }[];
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  ariaLabel: string;
}

export default function DatePickerModal({
  mode,
  selectedDate,
  onSelect,
  onClose,
  minDate,
  maxDate,
  disableWeekends = true,
  shortcuts,
  side = "bottom",
  align = "center",
  ariaLabel,
}: DatePickerModalProps) {
  const [visibleDate, setVisibleDate] = useState(selectedDate);
  const monthStart = startOfMonth(visibleDate);
  const firstDay = startOfWeek(monthStart);
  const lastDay = endOfWeek(endOfMonth(visibleDate));
  const days = Array.from(
    {
      length: differenceInCalendarDays(lastDay, firstDay) + 1,
    },
    (_, index) => addDays(firstDay, index),
  );
  const year = visibleDate.getFullYear();
  const decadeStart = Math.floor(year / 10) * 10;

  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [focusDate, setFocusDate] = useState<Date | null>(null);
  useEffect(() => {
    if (focusDate)
      buttons.current.get(format(focusDate, "yyyy-MM-dd"))?.focus();
  }, [focusDate]);

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
    if (disableWeekends) {
      const backwards = ["ArrowLeft", "ArrowUp", "PageUp", "End"].includes(
        event.key,
      );
      while (target.getDay() === 0 || target.getDay() === 6)
        target = addDays(target, backwards ? -1 : 1);
    }
    const boundary = mode === "week" ? addDays(startOfWeek(target), 1) : target;
    if (
      isAfterMax(boundary) ||
      isBeforeMin(mode === "week" ? startOfWeek(target) : target)
    )
      return;
    setVisibleDate(startOfMonth(target));
    setFocusDate(target);
  }

  function choose(date: Date) {
    onSelect(date);
    onClose();
  }

  function isAfterMax(date: Date) {
    return maxDate
      ? format(date, "yyyy-MM-dd") > format(maxDate, "yyyy-MM-dd")
      : false;
  }

  function isBeforeMin(date: Date) {
    return minDate
      ? format(date, "yyyy-MM-dd") < format(minDate, "yyyy-MM-dd")
      : false;
  }

  return (
    <Popover.Content
      className={styles.calendar}
      side={side}
      align={align}
      sideOffset={8}
      collisionPadding={16}
      aria-label={ariaLabel}
      onOpenAutoFocus={(event) => {
        const button = buttons.current.get(format(selectedDate, "yyyy-MM-dd"));
        if (button && !button.disabled) {
          event.preventDefault();
          button.focus();
        }
      }}
    >
      {(mode === "week" || mode === "date") && (
        <>
          <div className={styles.calendarHeader}>
            <button
              className={styles.calendarArrow}
              type="button"
              aria-label="Previous month"
              disabled={
                !!minDate && startOfMonth(visibleDate) <= startOfMonth(minDate)
              }
              onClick={() =>
                setVisibleDate(addMonths(startOfMonth(visibleDate), -1))
              }
            >
              <BogIcon name="chevron-left" size={24} />
            </button>
            <strong className={styles.calendarMonth} aria-live="polite">
              {format(visibleDate, "MMMM yyyy")}
            </strong>
            <button
              className={styles.calendarArrow}
              type="button"
              aria-label="Next month"
              disabled={
                !!maxDate && startOfMonth(visibleDate) >= startOfMonth(maxDate)
              }
              onClick={() =>
                setVisibleDate(addMonths(startOfMonth(visibleDate), 1))
              }
            >
              <BogIcon name="chevron-right" size={24} />
            </button>
          </div>
          <table
            className={styles.calendarGrid}
            aria-label={format(visibleDate, "MMMM yyyy")}
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
              {Array.from({ length: days.length / 7 }, (_, row) => (
                <tr key={row}>
                  {days.slice(row * 7, row * 7 + 7).map((date) => {
                    const key = format(date, "yyyy-MM-dd");
                    const weekday = date.getDay();
                    // Both the selected range and clicks use the same Sunday-anchored service week.
                    const monday = addDays(startOfWeek(date), 1);
                    const selected =
                      mode === "week"
                        ? isSameDay(
                            startOfWeek(date),
                            startOfWeek(selectedDate),
                          ) &&
                          weekday >= 1 &&
                          weekday <= 5
                        : isSameDay(date, selectedDate);
                    const boundedDate = mode === "week" ? monday : date;
                    const disabled =
                      !isSameMonth(date, visibleDate) ||
                      isAfterMax(boundedDate) ||
                      isBeforeMin(mode === "week" ? startOfWeek(date) : date) ||
                      (disableWeekends && (weekday === 0 || weekday === 6));
                    return (
                      <td
                        key={key}
                        aria-selected={selected}
                        className={
                          selected && mode === "week"
                            ? styles.selectedWeekDay
                            : undefined
                        }
                      >
                        <button
                          type="button"
                          ref={(element) => {
                            if (element) buttons.current.set(key, element);
                            else buttons.current.delete(key);
                          }}
                          onKeyDown={(event) => moveFocus(event, date)}
                          disabled={disabled}
                          aria-label={format(date, "EEEE, MMMM d, yyyy")}
                          className={
                            selected &&
                            (mode === "date" || weekday === 1 || weekday === 5)
                              ? styles.weekEndpoint
                              : undefined
                          }
                          onClick={() =>
                            choose(mode === "week" ? monday : date)
                          }
                        >
                          {format(date, "d")}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {mode === "month" && (
        <>
          <div className={styles.header}>
            <button
              type="button"
              aria-label="Previous year"
              onClick={() => setVisibleDate(addYears(visibleDate, -1))}
            >
              <BogIcon name="chevron-left" size={20} />
            </button>
            <strong aria-live="polite">{year}</strong>
            <button
              type="button"
              aria-label="Next year"
              disabled={maxDate !== undefined && year >= maxDate.getFullYear()}
              onClick={() => setVisibleDate(addYears(visibleDate, 1))}
            >
              <BogIcon name="chevron-right" size={20} />
            </button>
          </div>
          <div className={styles.periodGrid} aria-label={`${year} months`}>
            {Array.from(
              { length: 12 },
              (_, index) => new Date(year, index, 1),
            ).map((date) => {
              const key = format(date, "yyyy-MM");
              const disabled =
                maxDate !== undefined && key > format(maxDate, "yyyy-MM");
              const selected = key === format(selectedDate, "yyyy-MM");
              return disabled ? (
                <span key={key} aria-disabled="true">
                  {format(date, "MMM")}
                </span>
              ) : (
                <button
                  key={key}
                  type="button"
                  className={selected ? styles.selectedDate : undefined}
                  onClick={() => choose(date)}
                >
                  {format(date, "MMM")}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mode === "year" && (
        <>
          <div className={styles.header}>
            <button
              type="button"
              aria-label="Previous decade"
              onClick={() => setVisibleDate(addYears(visibleDate, -10))}
            >
              <BogIcon name="chevron-left" size={20} />
            </button>
            <strong aria-live="polite">
              {decadeStart}–{decadeStart + 9}
            </strong>
            <button
              type="button"
              aria-label="Next decade"
              disabled={
                maxDate !== undefined &&
                decadeStart + 10 > maxDate.getFullYear()
              }
              onClick={() => setVisibleDate(addYears(visibleDate, 10))}
            >
              <BogIcon name="chevron-right" size={20} />
            </button>
          </div>
          <div
            className={styles.periodGrid}
            aria-label={`${decadeStart} through ${decadeStart + 9}`}
          >
            {Array.from({ length: 10 }, (_, index) => decadeStart + index).map(
              (targetYear) => {
                const disabled =
                  maxDate !== undefined && targetYear > maxDate.getFullYear();
                const selected = targetYear === selectedDate.getFullYear();
                return disabled ? (
                  <span key={targetYear} aria-disabled="true">
                    {targetYear}
                  </span>
                ) : (
                  <button
                    key={targetYear}
                    type="button"
                    className={selected ? styles.selectedDate : undefined}
                    onClick={() => choose(new Date(targetYear, 0, 1))}
                  >
                    {targetYear}
                  </button>
                );
              },
            )}
          </div>
        </>
      )}

      {shortcuts.length > 0 && (
        <div className={styles.calendarShortcuts}>
          {shortcuts.map(({ label, date }) => (
            <button
              key={label}
              type="button"
              disabled={
                isAfterMax(date) ||
                isBeforeMin(date) ||
                (mode === "date" &&
                  disableWeekends &&
                  (date.getDay() === 0 || date.getDay() === 6))
              }
              onClick={() => choose(date)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </Popover.Content>
  );
}
