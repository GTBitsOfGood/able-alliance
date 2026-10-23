import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { isValidId } from "@/utils/ids";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import {
  getRouteById,
  markRouteMissing,
} from "@/server/db/actions/RouteAction";
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

  if (user.type !== "Driver") {
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
    const { routeId } = body as { routeId?: string };

    if (!routeId || !isValidId(routeId)) {
      return NextResponse.json(
        { error: "Invalid route ID" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }

    const route = await getRouteById(routeId);

    // Validate caller is the assigned driver
    const driverId = route.driver?.id;
    if (!driverId || driverId !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }

    const updated = await markRouteMissing(routeId);
    return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    return errorResponse(error);
  }
}
