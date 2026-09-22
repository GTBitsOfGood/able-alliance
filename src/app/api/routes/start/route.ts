import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/auth";
import { getRouteById, startRoute } from "@/server/db/actions/RouteAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";

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

    const driverId = (
      route.driver as { _id?: { toString(): string } } | undefined
    )?._id?.toString();

    if (!driverId || driverId !== session.user.userId) {
      return NextResponse.json(
        { error: "Forbidden: you are not the assigned driver for this route" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }

    const updated = await startRoute(routeId);
    if (!updated) {
      return NextResponse.json(
        { error: "Route not found or not in Scheduled state" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    console.error("[POST /api/routes/start]", e);
    if (e instanceof SyntaxError || e instanceof TypeError) {
      return NextResponse.json(
        { error: "Malformed request body" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}
