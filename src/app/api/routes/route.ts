import { NextRequest, NextResponse } from "next/server";
import {
  createRoute,
  getRouteById,
  getRoutes,
} from "@/server/db/actions/RouteAction";
import { routeSchema } from "@/utils/types";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { RouteAlreadyExistsException } from "@/utils/exceptions/route";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const studentId = searchParams.get("studentId");
    const driverId = searchParams.get("driverId");
    const pickupTime = searchParams.get("pickupTime");

    // Get specific route by ID
    if (id) {
      const route = await getRouteById(id);
      if (!route) {
        return NextResponse.json(
          { error: "Route not found" },
          { status: HTTP_STATUS_CODE.NOT_FOUND },
        );
      }
      return NextResponse.json(route, { status: HTTP_STATUS_CODE.OK });
    }

    // Get all routes with optional filters
    const filters: any = {};
    if (studentId) filters.studentId = studentId;
    if (driverId) filters.driverId = driverId;
    if (pickupTime) filters.pickupTime = new Date(pickupTime);

    const routes = await getRoutes(Object.keys(filters).length > 0 ? filters : undefined);
    return NextResponse.json(routes, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    if (e instanceof RouteAlreadyExistsException) {
      return NextResponse.json({ error: e.message }, { status: e.code });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = routeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(parsed.error.format(), {
        status: HTTP_STATUS_CODE.BAD_REQUEST,
      });
    }

    const created = await createRoute(parsed.data);
    const createdObj = created as Record<string, unknown> & {
      _id: { toString(): string };
    };
    return NextResponse.json(
      { ...createdObj, _id: createdObj._id.toString() },
      { status: HTTP_STATUS_CODE.CREATED },
    );
  } catch (e) {
    if (e instanceof RouteAlreadyExistsException) {
      return NextResponse.json({ error: e.message }, { status: e.code });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
