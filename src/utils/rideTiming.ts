import { addDays, format } from "date-fns";
import {
  PICKUP_WINDOW_MAX_MINUTES,
  SERVICE_END_TIME,
  SERVICE_START_TIME,
} from "./consts";
import {
  estDateKey,
  MINUTES_PER_DAY,
  parseCalendarDate,
  estNowWallClock,
  estTimeStr,
} from "./dateEst";

/** Convert a 24-hour HH:MM value to minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

/** Display schedule minutes, retaining previous/next-day annotations. */
export function formatMinutes(minutes: number): string {
  const minutesInDay =
    ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(minutesInDay / 60);
  const minuteLabel = String(minutesInDay % 60).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  const label = `${hours % 12 || 12}:${minuteLabel} ${period}`;

  if (minutes < 0) {
    return `${label} (prev day)`;
  }

  if (minutes >= MINUTES_PER_DAY) {
    return `${label} (next day)`;
  }

  return label;
}

export function formatMinuteRange(start: number, end: number): string {
  return `${formatMinutes(start)}–${formatMinutes(end)}`;
}

export const SERVICE_START_MINUTES = timeToMinutes(SERVICE_START_TIME);
export const SERVICE_END_MINUTES = timeToMinutes(SERVICE_END_TIME);
export const SERVICE_HOURS_LABEL = formatMinuteRange(
  SERVICE_START_MINUTES,
  SERVICE_END_MINUTES,
);

export function isPickupInServiceHours(minutes: number): boolean {
  return SERVICE_START_MINUTES <= minutes && minutes <= SERVICE_END_MINUTES;
}

/** Service dates are weekdays in the supplied New York calendar date. */
export function isServiceDate(date: string): boolean {
  const weekday = parseCalendarDate(date).getDay();

  return weekday >= 1 && weekday <= 5;
}

export function nextServiceDate(date: string): string {
  let serviceDate = parseCalendarDate(date);

  while (!isServiceDate(format(serviceDate, "yyyy-MM-dd"))) {
    serviceDate = addDays(serviceDate, 1);
  }

  return format(serviceDate, "yyyy-MM-dd");
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function getPickupWindowBounds(pickupTime: string) {
  if (!pickupTime) {
    return { from: SERVICE_START_TIME, to: SERVICE_END_TIME };
  }

  const time = timeToMinutes(pickupTime);
  const clamp = (value: string) =>
    value < SERVICE_START_TIME
      ? SERVICE_START_TIME
      : value > SERVICE_END_TIME
        ? SERVICE_END_TIME
        : value;

  return {
    from: clamp(minutesToTime(Math.max(0, time - PICKUP_WINDOW_MAX_MINUTES))),
    to: clamp(minutesToTime(Math.min(1439, time + PICKUP_WINDOW_MAX_MINUTES))),
  };
}

/** `date` contains the selected New York calendar date as local fields. */
export function getEarliestPickupTime(date: Date): string | null {
  const now = estNowWallClock();

  if (date.toDateString() !== now.toDateString()) {
    return SERVICE_START_TIME;
  }

  const nextSlot =
    Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 15) * 15;

  if (nextSlot >= 24 * 60) {
    return null;
  }

  const earliest = minutesToTime(nextSlot);

  if (earliest > SERVICE_END_TIME) {
    return null;
  }

  return earliest < SERVICE_START_TIME ? SERVICE_START_TIME : earliest;
}

export function getRideTimingError(
  input: {
    scheduledPickupTime: Date;
    pickupWindowStart: Date;
    pickupWindowEnd: Date;
  },
  now = Date.now(),
): string | null {
  const {
    scheduledPickupTime: pickup,
    pickupWindowStart: start,
    pickupWindowEnd: end,
  } = input;

  if (pickup.getTime() <= now) {
    return "Pickup time must be in the future.";
  }

  if (!isServiceDate(estDateKey(pickup))) {
    return "Rides must be scheduled Monday through Friday.";
  }

  if (start >= end) {
    return "Pickup window end must be after its start.";
  }

  if (start > pickup || end < pickup) {
    return "Pickup time must fall within the pickup window.";
  }

  const limit = PICKUP_WINDOW_MAX_MINUTES * 60_000;

  if (
    pickup.getTime() - start.getTime() > limit ||
    end.getTime() - pickup.getTime() > limit
  ) {
    return `Pickup window must be within ${PICKUP_WINDOW_MAX_MINUTES} minutes of the pickup time.`;
  }

  if (
    [pickup, start, end].some(
      (date) =>
        estDateKey(date) !== estDateKey(pickup) ||
        estTimeStr(date) < SERVICE_START_TIME ||
        estTimeStr(date) > SERVICE_END_TIME,
    )
  ) {
    return "Pickup time and window must be within service hours on the ride date.";
  }

  return null;
}
