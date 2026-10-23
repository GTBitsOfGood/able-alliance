import { NextRequest, NextResponse } from "next/server";
import { isValidId } from "@/utils/ids";
import { auth } from "@/auth";
import { getRouteById, pickupStudent } from "@/server/db/actions/RouteAction";
import { limitRouteInfo } from "@/server/db/queries";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { ArgumentError, errorResponse } from "@/utils/errors";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: HTTP_STATUS_CODE.UNAUTHORIZED },
      );
    }

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

    const route = await getRouteById(routeId);

    const driverId = route.driver?.id;

    if (!driverId || driverId !== session.user.userId) {
      return NextResponse.json(
        { error: "Forbidden: you are not the assigned driver for this route" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }

    const updated = await pickupStudent(routeId);
    return NextResponse.json(limitRouteInfo(updated), {
      status: HTTP_STATUS_CODE.OK,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
