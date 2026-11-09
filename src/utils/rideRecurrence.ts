import { addDays, differenceInCalendarWeeks, set } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import type { RecurrenceFrequency } from "@/schemas/rideSeries";

const TZ = "America/New_York";

/** Derive each occurrence from the first ride's Eastern date and time. */
export function nextOccurrence(
  firstPickupTime: Date,
  daysOfWeek: number[],
  after: Date,
  frequency: RecurrenceFrequency = "weekly",
): Date {
  const first = toZonedTime(firstPickupTime, TZ);
  const handled = toZonedTime(after, TZ);
  const ordinal = Math.floor((first.getDate() - 1) / 7);
  const maxDays =
    frequency === "monthly" ? 366 : frequency === "biweekly" ? 14 : 7;

  for (let offset = 1; offset <= maxDays; offset++) {
    const day = addDays(handled, offset);
    if (!daysOfWeek.includes(day.getDay())) continue;
    if (
      frequency === "biweekly" &&
      differenceInCalendarWeeks(day, first, { weekStartsOn: 0 }) % 2 !== 0
    )
      continue;
    // A fifth weekday is skipped in months that do not contain one.
    if (
      frequency === "monthly" &&
      Math.floor((day.getDate() - 1) / 7) !== ordinal
    )
      continue;
    return fromZonedTime(
      set(day, {
        hours: first.getHours(),
        minutes: first.getMinutes(),
        seconds: first.getSeconds(),
        milliseconds: first.getMilliseconds(),
      }),
      TZ,
    );
  }
  throw new Error("Ride series has no valid days to repeat on");
}
