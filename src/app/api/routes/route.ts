import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  createRoute,
  getRouteById,
  getRoutes,
} from "@/server/db/actions/RouteAction";
import { routeSchema } from "@/utils/types";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import {
  RouteAlreadyExistsException,
  RouteReferenceNotFoundException,
} from "@/utils/exceptions/route";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    // Get specific route by ID
    if (id) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json(
          { error: "Invalid route ID" },
          { status: HTTP_STATUS_CODE.BAD_REQUEST },
        );
      }
      const route = await getRouteById(id);
      if (!route) {
        return NextResponse.json(
          { error: "Route not found" },
          { status: HTTP_STATUS_CODE.NOT_FOUND },
        );
      }
      return NextResponse.json(route, { status: HTTP_STATUS_CODE.OK });
    }

    // Get all routes with optional filters: ?student=ID | ?driver=ID | ?start_time=<time> | ?end_time=<time>
    const student = searchParams.get("student");
    const driver = searchParams.get("driver");
    const startTime = searchParams.get("start_time");
    const endTime = searchParams.get("end_time");

    if (student && !mongoose.Types.ObjectId.isValid(student)) {
      return NextResponse.json(
        { error: "Invalid student ID" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    if (driver && !mongoose.Types.ObjectId.isValid(driver)) {
      return NextResponse.json(
        { error: "Invalid driver ID" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    if (startTime) {
      startDate = new Date(startTime);
      if (Number.isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid start_time" },
          { status: HTTP_STATUS_CODE.BAD_REQUEST },
        );
      }
    }
    if (endTime) {
      endDate = new Date(endTime);
      if (Number.isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid end_time" },
          { status: HTTP_STATUS_CODE.BAD_REQUEST },
        );
      }
    }

    const routes = await getRoutes({
      student: student ?? undefined,
      driver: driver ?? undefined,
      start_time: startDate,
      end_time: endDate,
    });
    return NextResponse.json(routes, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    if (
      e instanceof RouteAlreadyExistsException ||
      e instanceof RouteReferenceNotFoundException
    ) {
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
    const createdObj = created as unknown as Record<string, unknown> & {
      _id: { toString(): string };
    };
    return NextResponse.json(
      { ...createdObj, _id: createdObj._id.toString() },
      { status: HTTP_STATUS_CODE.CREATED },
    );
  } catch (e) {
    if (
      e instanceof RouteAlreadyExistsException ||
      e instanceof RouteReferenceNotFoundException
    ) {
      return NextResponse.json({ error: e.message }, { status: e.code });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
