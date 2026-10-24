import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { isValidId } from "@/utils/ids";
import { completeRoute, getRouteById } from "@/server/db/actions/RouteAction";
import { routeResponseForRole } from "@/server/db/queries";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { ArgumentError, errorResponse } from "@/utils/errors";

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
    if (type === "Driver") {
      const route = await getRouteById(routeId, type);
      if (route.driver?.id !== userId) {
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
    const updated = await completeRoute(routeId);
    return NextResponse.json(routeResponseForRole(updated, type), {
      status: HTTP_STATUS_CODE.OK,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
