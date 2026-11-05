import { NextRequest, NextResponse } from "next/server";
import { isValidId } from "@/utils/ids";
import { getUserFromRequest } from "@/utils/authUser";
import { getRouteById, arriveRoute } from "@/server/db/actions/RouteAction";
import { routeResponseForRole } from "@/server/db/queries";
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
  if (user.activeType !== "Driver") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
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
    if (!routeId || !isValidId(routeId)) {
      return NextResponse.json(
        { error: "Invalid routeId" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }

    const route = await getRouteById(routeId, user.activeType);

    const driverId = route.driver?.id;

    if (!driverId || driverId !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden: you are not the assigned driver for this route" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }

    const updated = await arriveRoute(routeId, user.userId);
    return NextResponse.json(routeResponseForRole(updated, user.activeType), {
      status: HTTP_STATUS_CODE.OK,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
