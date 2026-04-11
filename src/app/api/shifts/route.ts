import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { getUsers } from "@/server/db/actions/UserAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { estWeekRange } from "@/utils/dateEst";
import { addDays } from "date-fns";
import { toZonedTime, format as tzFormat } from "date-fns-tz";

const TZ = "America/New_York";
const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Format "HH:MM" 24-hour string as "h:mm AM/PM" */
function formatTime12(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

/** Given a week-start Sunday (UTC Date in EST context) and a dayOfWeek (0-6),
 *  return the YYYY-MM-DD string for that specific date in America/New_York. */
function dateForDay(weekSundayUtc: Date, dayOfWeek: number): string {
  const target = addDays(weekSundayUtc, dayOfWeek);
  return tzFormat(toZonedTime(target, TZ), "yyyy-MM-dd", { timeZone: TZ });
}

/** Format "YYYY-MM-DD" as "Month D" (e.g. "April 1") */
function formatDateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
}

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  if (user.type !== "Admin" && user.type !== "SuperAdmin") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const week = searchParams.get("week") ?? "all"; // "this" | "next" | "all"
    const dayParam = searchParams.get("day") ?? "all"; // "all" | "1"-"5"

    // Determine which weeks to expand
    const weekOffsets: Array<0 | 1> =
      week === "this" ? [0] : week === "next" ? [1] : [0, 1];

    // Fetch all drivers
    const drivers = await getUsers("Driver");

    type ShiftInstance = {
      driverId: string;
      driverName: string;
      date: string;
      dateLabel: string;
      dayName: string;
      startTime: string;
      endTime: string;
      startTime24: string;
      endTime24: string;
    };

    const instances: ShiftInstance[] = [];

    // Today's date string in EST — used to filter out past shifts
    const todayStr = tzFormat(toZonedTime(new Date(), TZ), "yyyy-MM-dd", {
      timeZone: TZ,
    });

    for (const weekOffset of weekOffsets) {
      const [weekStart] = estWeekRange(weekOffset);
      // weekStart is midnight of Sunday (EST) as UTC date

      for (const driver of drivers) {
        const driverName = `${driver.firstName} ${driver.lastName}`;
        const shifts =
          (
            driver as {
              shifts?: Array<{
                dayOfWeek: number;
                startTime: string;
                endTime: string;
              }>;
            }
          ).shifts ?? [];

        for (const shift of shifts) {
          const { dayOfWeek, startTime, endTime } = shift;

          // Only Mon-Fri (1-5) if filtered, or all
          if (dayParam !== "all" && String(dayOfWeek) !== dayParam) continue;

          const date = dateForDay(weekStart, dayOfWeek);

          // Skip shifts whose date is strictly before today
          if (date < todayStr) continue;

          instances.push({
            driverId: driver._id.toString(),
            driverName,
            date,
            dateLabel: formatDateLabel(date),
            dayName: DAY_NAMES[dayOfWeek],
            startTime: formatTime12(startTime),
            endTime: formatTime12(endTime),
            startTime24: startTime,
            endTime24: endTime,
          });
        }
      }
    }

    // Sort by date, then by startTime
    instances.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime24.localeCompare(b.startTime24);
    });

    return NextResponse.json(instances, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    console.error("[GET /api/shifts]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
