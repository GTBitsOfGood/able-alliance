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

  if (user.activeType !== "Student") {
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
        {
          error: `Delay must be a whole number from 1 to ${MAX_DELAY_MINUTES} minutes. Cancel your ride if you need longer.`,
        },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }

    const route = await getRouteById(routeId, user.activeType);

    // Only the student who owns the ride can report a delay.
    if (route.student.id !== user.userId) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }

    const updated = await delayRoute(routeId, delayMinutes, user.userId);
    return NextResponse.json(routeResponseForRole(updated, user.activeType), {
      status: HTTP_STATUS_CODE.OK,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
