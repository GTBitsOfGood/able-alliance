import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { scheduleRoute } from "@/server/db/actions/RouteAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { routeId, driverId, vehicleId } = body;
    if (!routeId || !driverId || !vehicleId) {
      return NextResponse.json(
        { error: "routeId, driverId, and vehicleId are required" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    if (
      !mongoose.Types.ObjectId.isValid(routeId) ||
      !mongoose.Types.ObjectId.isValid(driverId) ||
      !mongoose.Types.ObjectId.isValid(vehicleId)
    ) {
      return NextResponse.json(
        { error: "Invalid ObjectId(s)" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    const updated = await scheduleRoute(routeId, driverId, vehicleId);
    if (!updated) {
      return NextResponse.json(
        { error: "Route not found or not in Requested state" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    if (e instanceof Error && e.name === "RouteReferenceNotFoundException") {
      return NextResponse.json(
        { error: e.message },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
