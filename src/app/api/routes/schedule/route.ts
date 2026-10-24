import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { isValidId } from "@/utils/ids";
import {
  BookingConflictError,
  scheduleRoute,
} from "@/server/db/actions/RouteAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { ArgumentError, errorResponse } from "@/utils/errors";

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  try {
    const body = await request.json().catch(() => {
      throw new ArgumentError("Malformed request body");
    });
    if (typeof body !== "object" || body === null || Array.isArray(body))
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    const { routeId, driverId, vehicleId } = body;
    if (!routeId || !driverId || !vehicleId) {
      return NextResponse.json(
        { error: "routeId, driverId, and vehicleId are required" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    if (!isValidId(routeId) || !isValidId(driverId) || !isValidId(vehicleId)) {
      return NextResponse.json(
        { error: "Invalid UUID(s)" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    // Only allow: Admin, SuperAdmin
    if (!isAdmin(user.type)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }
    const updated = await scheduleRoute(routeId, driverId, vehicleId);
    return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    if (error instanceof BookingConflictError)
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.statusCode },
      );
    return errorResponse(error);
  }
}
