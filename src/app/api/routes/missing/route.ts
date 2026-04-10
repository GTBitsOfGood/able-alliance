import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import mongoose from "mongoose";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import {
  getRouteById,
  markRouteMissing,
} from "@/server/db/actions/RouteAction";

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

  if (user.type !== "Driver") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }

  try {
    const body = await request.json();
    const { routeId } = body as { routeId?: string };

    if (!routeId || !mongoose.Types.ObjectId.isValid(routeId)) {
      return NextResponse.json(
        { error: "Invalid route ID" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }

    const route = await getRouteById(routeId);
    if (!route) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }

    // Validate caller is the assigned driver
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const driverId = (route.driver as any)?._id?.toString();
    if (!driverId || driverId !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }

    const updated = await markRouteMissing(routeId);
    return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
