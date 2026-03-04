import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/auth";
import {
  cancelRoute,
  cancelRouteByDriver,
  getRouteById,
} from "@/server/db/actions/RouteAction";
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

    if (!routeId) {
      return NextResponse.json(
        { error: "routeId is required" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    if (!mongoose.Types.ObjectId.isValid(routeId)) {
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

    const userType = session.user.type;
    const userId = session.user.userId;
    let updated = null;

    if (userType === "Driver") {
      const driverId = (
        route as unknown as {
          driver?: { _id?: { toString(): string } };
        }
      ).driver?._id?.toString();

      if (!driverId || driverId !== userId) {
        return NextResponse.json(
          { error: "Forbidden: you are not the assigned driver for this route" },
          { status: HTTP_STATUS_CODE.FORBIDDEN },
        );
      }

      updated = await cancelRouteByDriver(routeId);
    } else if (userType === "Student") {
      const studentId = (
        route as unknown as {
          student?: { _id?: { toString(): string } };
        }
      ).student?._id?.toString();

      if (!studentId || studentId !== userId) {
        return NextResponse.json(
          {
            error:
              "Forbidden: you are not the student who requested this route",
          },
          { status: HTTP_STATUS_CODE.FORBIDDEN },
        );
      }

      updated = await cancelRoute(routeId);
    } else {
      return NextResponse.json(
        {
          error:
            "Forbidden: only the assigned driver or requesting student can cancel this route",
        },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Route not found" },
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
