"use client";

import { useState } from "react";
import { Popover } from "radix-ui";
import {
  addDays,
  addMonths,
  addYears,
  startOfMonth,
  startOfYear,
  startOfWeek,
  differenceInCalendarWeeks,
  format,
} from "date-fns";

import BogIcon from "@/components/BogIcon/BogIcon";
import DatePickerModal, {
  type DatePickerMode,
} from "@/components/DatePickerModal/DatePickerModal";
import {
  estDateKey,
  estDayRange,
  estWeekRange,
  parseCalendarDate,
} from "@/utils/dateEst";

import styles from "./styles.module.css";

export default function DatePicker({
  weekOffset = 0,
  onWeekChange,
  mode: requestedMode,
  compact = false,
  shortcutDirection = "next",
  maxDate,
  ready,
  disabled = false,
  selectedDate,
  onDateChange,
  allowPastWeeks = false,
  appearance = "week",
}: {
  appearance?: "week" | "date";
  mode?: DatePickerMode;
  compact?: boolean;
  shortcutDirection?: "previous" | "next";
  maxDate?: Date;
  weekOffset?: number;
  onWeekChange?: (offset: number) => void;
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
  const selectedDay = selectedDate ? parseCalendarDate(selectedDate) : monday;
  const rangeFormat =
    monday.getFullYear() === friday.getFullYear() ? "MMMM d" : "MMMM d, yyyy";
  const rangeLabel = `${format(monday, rangeFormat)} - ${format(friday, rangeFormat)}`;
  const mode: DatePickerMode =
    requestedMode ?? (onDateChange ? "date" : "week");
  const shift =
    mode === "month"
      ? addMonths
      : mode === "year"
        ? addYears
        : (date: Date, amount: number) => addDays(date, amount * 7);
  const periodStart =
    mode === "month"
      ? startOfMonth
      : mode === "year"
        ? startOfYear
        : (date: Date) =>
            requestedMode === "week"
              ? startOfWeek(date, { weekStartsOn: 1 })
              : addDays(date, 1 - date.getDay());
  const periodName =
    mode === "month" ? "month" : mode === "year" ? "year" : "week";
  const today = parseCalendarDate(estDateKey(new Date()));
  const current = periodStart(today);
  const displayLabel =
    mode === "month"
      ? format(selectedDay, "MMMM yyyy")
      : mode === "year"
        ? format(selectedDay, "yyyy")
        : selectedDate
          ? `${format(periodStart(selectedDay), rangeFormat)} - ${format(addDays(periodStart(selectedDay), 4), rangeFormat)}`
          : rangeLabel;
  function changePeriod(amount: number) {
    if (onDateChange)
      onDateChange(format(shift(selectedDay, amount), "yyyy-MM-dd"));
    else
      onWeekChange?.(
        Math.max(allowPastWeeks ? -Infinity : 0, weekOffset + amount),
      );
  }

  function selectWeek(offset: number) {
    const targetOffset = allowPastWeeks ? offset : Math.max(0, offset);
    if (onDateChange) {
      const targetMonday = addDays(currentWeek, targetOffset * 7 + 1);
      onDateChange(format(targetMonday, "yyyy-MM-dd"));
    } else {
      onWeekChange?.(targetOffset);
    }
    setOpen(false);
  }

  const shortcuts =
    mode === "date"
      ? [
          {
            label: "Today",
            date: parseCalendarDate(estDateKey(estDayRange(0)[0])),
          },
          {
            label: "Tomorrow",
            date: parseCalendarDate(estDateKey(estDayRange(1)[0])),
          },
        ]
      : shortcutDirection === "previous"
        ? [
            { label: `Previous ${periodName}`, date: shift(current, -1) },
            { label: `This ${periodName}`, date: current },
          ]
        : [
            { label: `This ${periodName}`, date: current },
            { label: `Next ${periodName}`, date: shift(current, 1) },
          ];

  return (
    <nav
      className={
        appearance === "date"
          ? styles.datePicker
          : `${styles.weekNavigator} ${compact ? styles.compact : ""}`
      }
      aria-label={
        appearance === "date"
          ? "Schedule date"
          : onDateChange
            ? "Browse schedule by week"
            : "Browse rides by week"
      }
    >
      {appearance === "week" && (
        <button
          type="button"
          className={styles.weekButton}
          aria-label="Previous week"
          disabled={
            !ready ||
            disabled ||
            (!allowPastWeeks && !selectedDate && weekOffset === 0)
          }
          onClick={() => changePeriod(-1)}
        >
          <BogIcon name="chevron-left" size={32} />
        </button>
      )}
      {appearance === "date" && <span>Date</span>}
      <Popover.Root open={open} onOpenChange={setOpen}>
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
                : `Choose ${periodName}, ${displayLabel}`
            }
          >
            {appearance === "date" ? (
              <>
                <span>{format(selectedDay, "MM/dd/yy")}</span>
                <BogIcon name="calendar" size={18} weight="regular" />
              </>
            ) : (
              <>
                <span>
                  {mode === "month"
                    ? "Month of"
                    : mode === "year"
                      ? "Year"
                      : "Week of"}
                </span>
                <span
                  className={styles.weekDates}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {ready ? displayLabel : "Loading…"}
                </span>
              </>
            )}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <DatePickerModal
            mode={mode}
            selectedDate={selectedDay}
            onClose={() => setOpen(false)}
            onSelect={(date) => {
              if (onDateChange) onDateChange(format(date, "yyyy-MM-dd"));
              else selectWeek(differenceInCalendarWeeks(date, currentWeek));
            }}
            maxDate={maxDate}
            minDate={!allowPastWeeks && !onDateChange ? currentWeek : undefined}
            shortcuts={shortcuts}
            ariaLabel={
              onDateChange ? "Choose a schedule date" : "Choose a week"
            }
          />
        </Popover.Portal>
      </Popover.Root>
      {appearance === "week" && (
        <button
          type="button"
          className={styles.weekButton}
          aria-label="Next week"
          disabled={
            !ready ||
            disabled ||
            (!!maxDate && shift(periodStart(selectedDay), 1) > maxDate)
          }
          onClick={() => changePeriod(1)}
        >
          <BogIcon name="chevron-right" size={32} />
        </button>
      )}
    </nav>
  );
}
