import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { getUserById } from "@/server/db/actions/UserAction";
import { getRoutes } from "@/server/db/actions/RouteAction";
import { errorResponse } from "@/utils/errors";

import { RouteStatus } from "@db/generated/enums";

import { isValidId } from "@/utils/ids";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

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

function formatTime12(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${period}`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ driverId: string }> },
) {
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

  const { driverId: rawDriverId } = await params;
  const driverId = rawDriverId.toLowerCase();
  if (!isValidId(driverId)) {
    return NextResponse.json(
      { error: "Invalid driver ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  const dateParam = new URL(req.url).searchParams.get("date"); // YYYY-MM-DD
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { error: "date query param required (YYYY-MM-DD)" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  try {
    const driver = await getUserById(driverId);
    if (driver.type !== "Driver") {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }

    // Parse the date in EST — use string form so fromZonedTime treats it as EST
    // dateParam is already "YYYY-MM-DD"
    const estMidnightUTC = fromZonedTime(`${dateParam}T00:00:00`, TZ);
    const dayOfWeek = toZonedTime(estMidnightUTC, TZ).getDay(); // 0=Sun … 6=Sat

    const driverShifts = driver.shifts ?? [];

    const shift = driverShifts.find((s) => s.dayOfWeek === dayOfWeek);
    if (!shift) {
      return NextResponse.json(
        { error: "Driver has no shift on this day" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }

    // Compute UTC boundaries for this calendar day in EST
    const dayStart = fromZonedTime(`${dateParam}T00:00:00`, TZ);
    const dayEnd = fromZonedTime(`${dateParam}T23:59:59`, TZ);

    // Compute UTC boundaries for the shift window itself
    const shiftStart = fromZonedTime(`${dateParam}T${shift.startTime}:00`, TZ);
    const shiftEnd = fromZonedTime(`${dateParam}T${shift.endTime}:00`, TZ);

    // Scheduled routes for this driver on this date (all non-requested statuses)
    const scheduledRoutes = await getRoutes({
      driver: driverId,
      start_time: dayStart,
      end_time: dayEnd,
    });

    // Requested routes (no driver) that fall within the shift time window
    const requestedRoutes = await getRoutes({
      status: RouteStatus.Requested,
      start_time: shiftStart,
      end_time: shiftEnd,
    });

    return NextResponse.json(
      {
        driver,
        date: dateParam,
        dayName: DAY_NAMES[dayOfWeek],
        startTime: shift.startTime,
        endTime: shift.endTime,
        startTimeLabel: formatTime12(shift.startTime),
        endTimeLabel: formatTime12(shift.endTime),
        shiftStartIso: shiftStart.toISOString(),
        shiftEndIso: shiftEnd.toISOString(),
        scheduledRoutes,
        requestedRoutes,
      },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
