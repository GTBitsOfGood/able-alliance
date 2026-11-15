/**
 * EST/EDT-aware date utilities backed by date-fns + date-fns-tz.
 * All timezone math is delegated to the library — no manual offset arithmetic.
 */

import {
  startOfDay,
  endOfDay,
  startOfWeek,
  addDays,
  addWeeks,
  getDay,
  differenceInCalendarDays,
} from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

export const EST_TIME_ZONE = "America/New_York";
export const MINUTES_PER_DAY = 24 * 60;
export const MILLISECONDS_PER_DAY = MINUTES_PER_DAY * 60 * 1000;

/** "YYYY-MM-DD" key for a UTC Date in America/New_York. */
export function estDateKey(date: Date): string {
  return formatInTimeZone(date, EST_TIME_ZONE, "yyyy-MM-dd");
}

/** Day of week in America/New_York (0 = Sunday … 6 = Saturday). */
export function estDayOfWeek(date: Date): number {
  return getDay(toZonedTime(date, EST_TIME_ZONE));
}

/** "HH:MM" (24-hour) string in America/New_York — for shift-time comparison. */
export function estTimeStr(date: Date): string {
  return formatInTimeZone(date, EST_TIME_ZONE, "HH:mm");
}

/** Start of the America/New_York calendar day (midnight) as a UTC Date. */
export function startOfEstDay(date: Date): Date {
  return fromZonedTime(
    startOfDay(toZonedTime(date, EST_TIME_ZONE)),
    EST_TIME_ZONE,
  );
}

/** End of the America/New_York calendar day (23:59:59.999) as a UTC Date. */
export function endOfEstDay(date: Date): Date {
  return fromZonedTime(
    endOfDay(toZonedTime(date, EST_TIME_ZONE)),
    EST_TIME_ZONE,
  );
}

/** [start, end] UTC dates for today + offsetDays calendar days in America/New_York. */
export function estDayRange(offsetDays: 0 | 1): [Date, Date] {
  const todayZoned = toZonedTime(new Date(), EST_TIME_ZONE);
  const targetZoned = addDays(todayZoned, offsetDays);
  return [
    fromZonedTime(startOfDay(targetZoned), EST_TIME_ZONE),
    fromZonedTime(endOfDay(targetZoned), EST_TIME_ZONE),
  ];
}

/** [start, end] UTC dates for the given week offset, Sunday-anchored, in America/New_York. */
export function estWeekRange(offsetWeeks: number): [Date, Date] {
  const todayZoned = toZonedTime(new Date(), EST_TIME_ZONE);
  const sundayZoned = startOfWeek(todayZoned, { weekStartsOn: 0 });
  const weekStartZoned = addWeeks(sundayZoned, offsetWeeks);
  const weekEndZoned = addDays(weekStartZoned, 6);
  return [
    fromZonedTime(startOfDay(weekStartZoned), EST_TIME_ZONE),
    fromZonedTime(endOfDay(weekEndZoned), EST_TIME_ZONE),
  ];
}

/** Start of the Sunday-anchored week in America/New_York as a UTC Date. */
export function startOfEstWeek(date: Date): Date {
  const zoned = toZonedTime(date, EST_TIME_ZONE);
  return fromZonedTime(startOfWeek(zoned, { weekStartsOn: 0 }), EST_TIME_ZONE);
}

/** Format a UTC Date as a time string in America/New_York (e.g. "3:45 PM"). */
export function formatEstTime(date: Date): string {
  return formatInTimeZone(date, EST_TIME_ZONE, "h:mm a");
}

/**
 * Format a UTC Date as a locale date string in America/New_York.
 * Accepts the same options as toLocaleDateString.
 */
export function formatEstDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return date.toLocaleDateString("en-US", {
    timeZone: EST_TIME_ZONE,
    ...options,
  });
}

/**
 * Current America/New_York wall-clock time, as a Date whose local fields
 * (getFullYear, getDate, getHours, …) read as New York time regardless of the
 * browser's timezone. Use only its fields — its getTime() is not the real instant.
 */
export function estNowWallClock(): Date {
  return toZonedTime(new Date(), EST_TIME_ZONE);
}

/** True if the UTC Date falls on today's calendar day in America/New_York. */
export function isEstToday(date: Date): boolean {
  return estDateKey(date) === estDateKey(new Date());
}

export function withDelay(date: Date, delayMinutes: number): Date {
  return new Date(date.getTime() + delayMinutes * 60_000);
}

/** Parse a date key into local calendar fields, without a UTC date shift. */
export function parseCalendarDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

/** Minutes relative to a New York calendar date, including neighbouring days. */
export function minutesFromEstDate(date: Date, referenceDate: string): number {
  const localDate = toZonedTime(date, EST_TIME_ZONE);
  const dayOffset = differenceInCalendarDays(
    localDate,
    parseCalendarDate(referenceDate),
  );

  return (
    dayOffset * MINUTES_PER_DAY +
    localDate.getHours() * 60 +
    localDate.getMinutes()
  );
}
