import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { isValidId } from "@/utils/ids";
import { auth } from "@/auth";
import {
  createRoute,
  getRouteById,
  getRoutes,
} from "@/server/db/actions/RouteAction";
import { createRouteSchema } from "@/utils/types";
import { RouteStatus } from "@db/generated/client";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { ArgumentError, errorResponse } from "@/utils/errors";

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
      if (!isValidId(id)) {
        return NextResponse.json(
          { error: "Invalid route ID" },
          { status: HTTP_STATUS_CODE.BAD_REQUEST },
        );
      }
      const route = await getRouteById(id, user.type);
      // Only allow: Admin/SuperAdmin, or owner (student.id or driver.id matches userId)
      if (
        isAdmin(user.type) ||
        (route.student && route.student.id === user.userId) ||
        (route.driver && route.driver.id === user.userId)
      ) {
        return NextResponse.json(route, { status: HTTP_STATUS_CODE.OK });
      }
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
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

    // optional filters: ?student=ID | ?driver=ID | ?vehicle=ID | ?status=<RouteStatus> | ?start_time=<time> | ?end_time=<time>
    const studentParam = searchParams.get("student");
    const driver = searchParams.get("driver");
    const vehicleParam = searchParams.get("vehicle");
    const statusParam = searchParams.get("status");
    const startTime = searchParams.get("start_time");
    const endTime = searchParams.get("end_time");

    let studentFilter: string | undefined;

    if (userType === "Student") {
      // actual Student check that makes it so they only see THEIR rides
      if (!isValidId(loggedInUserId)) {
        return NextResponse.json(
          { error: "Invalid student ID" },
          { status: HTTP_STATUS_CODE.BAD_REQUEST },
        );
      }
      studentFilter = loggedInUserId;
    } else if (studentParam) {
      // Admins / Drivers may filter by an explicit student id
      if (!isValidId(studentParam)) {
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
    if (driver && !isValidId(driver)) {
      return NextResponse.json(
        { error: "Invalid driver ID" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    if (vehicleParam && !isValidId(vehicleParam)) {
      return NextResponse.json(
        { error: "Invalid vehicle ID" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }

    if (
      statusParam &&
      !(Object.values(RouteStatus) as string[]).includes(statusParam)
    ) {
      return NextResponse.json(
        { error: "Invalid status" },
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

    const routes = await getRoutes(
      {
        student: studentFilter,
        driver: driver ?? undefined,
        vehicle: vehicleParam ?? undefined,
        status: (statusParam as RouteStatus | null) ?? undefined,
        start_time: startDate,
        end_time: endDate,
      },
      user.type,
    );
    return NextResponse.json(routes, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    return errorResponse(error);
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

    const body = await request.json().catch(() => {
      throw new ArgumentError("Malformed request body");
    });
    if (typeof body !== "object" || body === null || Array.isArray(body))
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );

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
    return NextResponse.json(created, { status: HTTP_STATUS_CODE.CREATED });
  } catch (error) {
    return errorResponse(error);
  }
}
