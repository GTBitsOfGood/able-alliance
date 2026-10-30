import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { isValidId } from "@/utils/ids";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { getRouteById, delayRoute } from "@/server/db/actions/RouteAction";
import { routeResponseForRole } from "@/server/db/queries";
import { ArgumentError, errorResponse } from "@/utils/errors";
import { MAX_DELAY_MINUTES } from "@/utils/consts";

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
    const { routeId, delayMinutes } = body as {
      routeId?: string;
      delayMinutes?: number;
    };

    if (!routeId || !isValidId(routeId)) {
      return NextResponse.json(
        { error: "Invalid route ID" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }

    if (
      typeof delayMinutes !== "number" ||
      !Number.isInteger(delayMinutes) ||
      delayMinutes <= 0 ||
      delayMinutes > MAX_DELAY_MINUTES
    ) {
      return NextResponse.json(
        { error: "Invalid delay minutes" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }

    const route = await getRouteById(routeId, user.type);

    // Validate caller is the assigned driver
    const driverId = route.driver?.id;
    if (!driverId || driverId !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }

    const updated = await delayRoute(routeId, delayMinutes);
    return NextResponse.json(routeResponseForRole(updated, user.type), {
      status: HTTP_STATUS_CODE.OK,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
