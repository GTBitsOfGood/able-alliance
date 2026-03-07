import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import mongoose from "mongoose";
import { cancelRoute, getRouteById } from "@/server/db/actions/RouteAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";

export async function POST(request: NextRequest) {
  let userId, type;
  try {
    const user = await getUserFromRequest();
    userId = user.userId;
    type = user.type;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
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
    // Ownership/role check
    if (type === "Student") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((route.student as any)?._id?.toString() !== userId) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: HTTP_STATUS_CODE.FORBIDDEN },
        );
      }
    } else if (type === "Driver") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((route.driver as any)?._id?.toString() !== userId) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: HTTP_STATUS_CODE.FORBIDDEN },
        );
      }
    } else if (type !== "Admin" && type !== "SuperAdmin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }
    // Set cancellation status based on caller type
    let cancelStatus;
    if (type === "Student") {
      cancelStatus = "Cancelled by Student";
    } else if (type === "Driver") {
      cancelStatus = "Cancelled by Driver";
    } else {
      cancelStatus = "Cancelled by Admin";
    }
    const updated = await cancelRoute(routeId, cancelStatus);
    if (!updated) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
