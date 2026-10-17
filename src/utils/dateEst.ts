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
} from "date-fns";
import { toZonedTime, fromZonedTime, formatInTimeZone } from "date-fns-tz";

const TZ = "America/New_York";

/** "YYYY-MM-DD" key for a UTC Date in America/New_York. */
export function estDateKey(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}

/** Day of week in America/New_York (0 = Sunday … 6 = Saturday). */
export function estDayOfWeek(date: Date): number {
  return getDay(toZonedTime(date, TZ));
}

/** "HH:MM" (24-hour) string in America/New_York — for shift-time comparison. */
export function estTimeStr(date: Date): string {
  return formatInTimeZone(date, TZ, "HH:mm");
}

/** Start of the America/New_York calendar day (midnight) as a UTC Date. */
export function startOfEstDay(date: Date): Date {
  return fromZonedTime(startOfDay(toZonedTime(date, TZ)), TZ);
}

/** End of the America/New_York calendar day (23:59:59.999) as a UTC Date. */
export function endOfEstDay(date: Date): Date {
  return fromZonedTime(endOfDay(toZonedTime(date, TZ)), TZ);
}

/** [start, end] UTC dates for today + offsetDays calendar days in America/New_York. */
export function estDayRange(offsetDays: 0 | 1): [Date, Date] {
  const todayZoned = toZonedTime(new Date(), TZ);
  const targetZoned = addDays(todayZoned, offsetDays);
  return [
    fromZonedTime(startOfDay(targetZoned), TZ),
    fromZonedTime(endOfDay(targetZoned), TZ),
  ];
}

/** [start, end] UTC dates for week 0 (this) or week 1 (next), Sunday-anchored, in America/New_York. */
export function estWeekRange(offsetWeeks: 0 | 1): [Date, Date] {
  const todayZoned = toZonedTime(new Date(), TZ);
  const sundayZoned = startOfWeek(todayZoned, { weekStartsOn: 0 });
  const weekStartZoned = addWeeks(sundayZoned, offsetWeeks);
  const weekEndZoned = addDays(weekStartZoned, 6);
  return [
    fromZonedTime(startOfDay(weekStartZoned), TZ),
    fromZonedTime(endOfDay(weekEndZoned), TZ),
  ];
}

/** Start of the Sunday-anchored week in America/New_York as a UTC Date. */
export function startOfEstWeek(date: Date): Date {
  const zoned = toZonedTime(date, TZ);
  return fromZonedTime(startOfWeek(zoned, { weekStartsOn: 0 }), TZ);
}

/** Format a UTC Date as a time string in America/New_York (e.g. "3:45 PM"). */
export function formatEstTime(date: Date): string {
  return formatInTimeZone(date, TZ, "h:mm a");
}

/**
 * Format a UTC Date as a locale date string in America/New_York.
 * Accepts the same options as toLocaleDateString.
 */
export function formatEstDate(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  return date.toLocaleDateString("en-US", { timeZone: TZ, ...options });
}

/** True if the UTC Date falls on today's calendar day in America/New_York. */
export function isEstToday(date: Date): boolean {
  return estDateKey(date) === estDateKey(new Date());
}
