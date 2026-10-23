import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { isValidId } from "@/utils/ids";
import { cancelRoute, getRouteById } from "@/server/db/actions/RouteAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { ArgumentError, errorResponse } from "@/utils/errors";
import { RouteStatus } from "@db/generated/enums";
import { limitRouteInfo } from "@/server/db/queries";

export async function POST(request: NextRequest) {
  let userId, type;
  try {
    const user = await getUserFromRequest();
    userId = user.userId;
    type = user.type;
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
    const { routeId } = body;

    if (!routeId) {
      return NextResponse.json(
        { error: "routeId is required" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    if (!isValidId(routeId)) {
      return NextResponse.json(
        { error: "Invalid routeId" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }

    const route = await getRouteById(routeId);

    // Ownership/role check
    if (type === "Student") {
      if (route.student.id !== userId) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: HTTP_STATUS_CODE.FORBIDDEN },
        );
      }
    } else if (!isAdmin(type)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }
    // Set cancellation status based on caller type
    const cancelStatus =
      type === "Student"
        ? RouteStatus.CancelledByStudent
        : RouteStatus.CancelledByAdmin;
    const updated = await cancelRoute(routeId, cancelStatus);
    return NextResponse.json(limitRouteInfo(updated, isAdmin(type)), {
      status: HTTP_STATUS_CODE.OK,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
