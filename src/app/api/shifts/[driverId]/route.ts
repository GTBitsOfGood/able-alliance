import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import connectMongoDB from "@/server/db/mongodb";
import UserModel from "@/server/db/models/UserModel";
import RouteModel from "@/server/db/models/RouteModel";
import LocationModel from "@/server/db/models/LocationModel";
import mongoose from "mongoose";
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

  const { driverId } = await params;
  if (!mongoose.Types.ObjectId.isValid(driverId)) {
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
    await connectMongoDB();

    const driver = await UserModel.findById(driverId).lean();
    if (!driver || driver.type !== "Driver") {
      return NextResponse.json(
        { error: "Driver not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }

    // Parse the date in EST — use string form so fromZonedTime treats it as EST
    // dateParam is already "YYYY-MM-DD"
    const estMidnightUTC = fromZonedTime(`${dateParam}T00:00:00`, TZ);
    const dayOfWeek = toZonedTime(estMidnightUTC, TZ).getDay(); // 0=Sun … 6=Sat

    const driverShifts =
      (
        driver as {
          shifts?: Array<{
            dayOfWeek: number;
            startTime: string;
            endTime: string;
          }>;
        }
      ).shifts ?? [];

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
    const scheduledRoutes = await RouteModel.find({
      "driver._id": new mongoose.Types.ObjectId(driverId),
      scheduledPickupTime: { $gte: dayStart, $lte: dayEnd },
    }).lean();

    // Requested routes (no driver) that fall within the shift time window
    const requestedRoutes = await RouteModel.find({
      status: "Requested",
      scheduledPickupTime: { $gte: shiftStart, $lte: shiftEnd },
    }).lean();

    // Collect all location IDs to resolve
    const locationIds = new Set<string>();
    for (const r of [...scheduledRoutes, ...requestedRoutes]) {
      locationIds.add(r.pickupLocation.toString());
      locationIds.add(r.dropoffLocation.toString());
    }
    const locations = await LocationModel.find({
      _id: {
        $in: [...locationIds].map((id) => new mongoose.Types.ObjectId(id)),
      },
    }).lean();
    const locationMap: Record<string, string> = {};
    for (const loc of locations) {
      locationMap[loc._id.toString()] = loc.name;
    }

    const serialize = (r: (typeof scheduledRoutes)[number]) => ({
      _id: r._id.toString(),
      status: r.status,
      student: r.student,
      driver: r.driver,
      vehicle: r.vehicle,
      scheduledPickupTime: r.scheduledPickupTime.toISOString(),
      pickupWindowStart: r.pickupWindowStart.toISOString(),
      pickupWindowEnd: r.pickupWindowEnd.toISOString(),
      estimatedDropoffTime: r.estimatedDropoffTime?.toISOString(),
      pickupLocationName: locationMap[r.pickupLocation.toString()] ?? "",
      dropoffLocationName: locationMap[r.dropoffLocation.toString()] ?? "",
    });

    return NextResponse.json(
      {
        driver: {
          _id: driver._id.toString(),
          firstName: driver.firstName,
          lastName: driver.lastName,
        },
        date: dateParam,
        dayName: DAY_NAMES[dayOfWeek],
        startTime: shift.startTime,
        endTime: shift.endTime,
        startTimeLabel: formatTime12(shift.startTime),
        endTimeLabel: formatTime12(shift.endTime),
        shiftStartIso: shiftStart.toISOString(),
        shiftEndIso: shiftEnd.toISOString(),
        scheduledRoutes: scheduledRoutes.map(serialize),
        requestedRoutes: requestedRoutes.map(serialize),
      },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (e) {
    console.error("[GET /api/shifts/[driverId]]", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
