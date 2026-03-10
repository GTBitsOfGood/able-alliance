import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import mongoose from "mongoose";
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
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
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
      // Only allow: Admin/SuperAdmin, or owner (student._id or driver._id matches userId)
      if (
        user.type === "Admin" ||
        user.type === "SuperAdmin" ||
        (route.student &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (route.student as any)._id?.toString() === user.userId) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (route.driver && (route.driver as any)._id?.toString() === user.userId)
      ) {
        return NextResponse.json(route, { status: HTTP_STATUS_CODE.OK });
      }
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
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

    // Only allow: Admin/SuperAdmin, or filter by own userId if Student/Driver
    if (user.type === "Admin" || user.type === "SuperAdmin") {
      const routes = await getRoutes({
        student: student ?? undefined,
        driver: driver ?? undefined,
        start_time: startDate,
        end_time: endDate,
      });
      return NextResponse.json(routes, { status: HTTP_STATUS_CODE.OK });
    } else if (user.type === "Student") {
      const routes = await getRoutes({
        student: user.userId,
        start_time: startDate,
        end_time: endDate,
      });
      return NextResponse.json(routes, { status: HTTP_STATUS_CODE.OK });
    } else if (user.type === "Driver") {
      const routes = await getRoutes({
        driver: user.userId,
        start_time: startDate,
        end_time: endDate,
      });
      return NextResponse.json(routes, { status: HTTP_STATUS_CODE.OK });
    }
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
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
  try {
    // Get the authenticated user's session
    const session = await auth();
    if (!session?.user?.userId) {
      return NextResponse.json(
        { error: "Unauthorized: No valid session" },
        { status: HTTP_STATUS_CODE.UNAUTHORIZED },
      );
    }

    const body = await request.json();

    // Add the student ID from the session
    const routeData = {
      ...body,
      student: session.user.userId,
    };

    const parsed = createRouteSchema.safeParse(routeData);
    if (!parsed.success) {
      return NextResponse.json(parsed.error.format(), {
        status: HTTP_STATUS_CODE.BAD_REQUEST,
      });
    }

    if (!(user.type === "Student" && user.userId === parsed.data.student)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
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
