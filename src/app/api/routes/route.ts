import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/auth";
import {
  createRoute,
  getRouteById,
  getRoutes,
} from "@/server/db/actions/RouteAction";
import { createRouteSchema } from "@/utils/types";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import {
  RouteAlreadyExistsException,
  RouteReferenceNotFoundException,
} from "@/utils/exceptions/route";
import { internalErrorPayload } from "@/utils/apiError";

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

    const session = await auth();
    if (!session?.user?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: HTTP_STATUS_CODE.UNAUTHORIZED },
      );
    }

    const userType = session.user.type;
    const loggedInUserId = session.user.userId;

    // optional filters: ?student=ID | ?driver=ID | ?start_time=<time> | ?end_time=<time>
    const studentParam = searchParams.get("student");
    const driver = searchParams.get("driver");
    const startTime = searchParams.get("start_time");
    const endTime = searchParams.get("end_time");

    let studentFilter: string | undefined;

    if (userType === "Student") {
      // actual Student check that makes it so they only see THEIR rides
      if (!mongoose.Types.ObjectId.isValid(loggedInUserId)) {
        return NextResponse.json(
          { error: "Invalid student ID" },
          { status: HTTP_STATUS_CODE.BAD_REQUEST },
        );
      }
      studentFilter = loggedInUserId;
    } else if (studentParam) {
      // Admins / Drivers may filter by an explicit student id
      if (!mongoose.Types.ObjectId.isValid(studentParam)) {
        return NextResponse.json(
          { error: "Invalid student ID" },
          { status: HTTP_STATUS_CODE.BAD_REQUEST },
        );
      }
      studentFilter = studentParam;
    } else {
      // Admins / Drivers without ?student can see all matching routes
      studentFilter = undefined;
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
      student: studentFilter,
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
    const parsed = createRouteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(parsed.error.format(), {
        status: HTTP_STATUS_CODE.BAD_REQUEST,
      });
    }

    // Driver and vehicle must not be set on create; use POST /api/routes/schedule instead.
    if (body.driver != null || body.vehicle != null) {
      return NextResponse.json(
        {
          error:
            "driver and vehicle cannot be set when creating a route; use POST /api/routes/schedule to assign them after creation",
        },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
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
    const payload = internalErrorPayload(e);
    return NextResponse.json(payload, {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}
