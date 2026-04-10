import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { getRouteById, pickupStudent } from "@/server/db/actions/RouteAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: HTTP_STATUS_CODE.UNAUTHORIZED },
      );
    }

    const body = await request.json();
    const { routeId } = body;
    if (!routeId || !mongoose.Types.ObjectId.isValid(routeId)) {
      return NextResponse.json(
        { error: "Invalid routeId" },
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

    const driverId = (
      route as unknown as {
        driver?: { _id: { toString(): string } };
      }
    ).driver?._id?.toString();

    if (!driverId || driverId !== session.user.userId) {
      return NextResponse.json(
        { error: "Forbidden: you are not the assigned driver for this route" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }

    const updated = await pickupStudent(routeId);
    if (!updated) {
      return NextResponse.json(
        { error: "Route not found or not in En-route state" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
