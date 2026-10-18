import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getUserFromRequest } from "@/utils/authUser";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";
import {
  schedulingLockKeys,
  scheduleRouteWhileLocked,
  withSchedulingLock,
} from "@/server/db/actions/RouteAction";
import {
  BookingConflictException,
  DriverNotAvailableException,
  RouteReferenceNotFoundException,
  SchedulingBusyException,
} from "@/utils/exceptions/route";
import {
  planDay,
  formatMinutes,
  AutoScheduleConflictError,
} from "@/server/scheduling/autoSchedule";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireAdmin() {
  try {
    const user = await getUserFromRequest();
    if (user.type === "Admin" || user.type === "SuperAdmin") return null;
    return NextResponse.json(
      { error: "Only admins can use auto-scheduling." },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  } catch {
    return NextResponse.json(
      { error: "You must be signed in to use auto-scheduling." },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    return badRequest(
      date ? `"${date}" is not a valid date.` : "Pick a date to schedule.",
      ["Use the date query parameter in YYYY-MM-DD format."],
    );
  }
  try {
    return NextResponse.json(await planDay(date));
  } catch (e) {
    console.error("[GET /api/routes/auto-schedule]", e);
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}

type Assignment = { rideId: string; driverId: string; vehicleId: string };

function badRequest(error: string, details: string[] = []) {
  return NextResponse.json(
    { error, details },
    { status: HTTP_STATUS_CODE.BAD_REQUEST },
  );
}

/** Returns field-level problems with a POST body, or [] when it is usable. */
function validateBody(body: unknown): string[] {
  if (!body || typeof body !== "object") return ["Body must be a JSON object."];
  const { date, assignments } = body as Record<string, unknown>;
  const problems: string[] = [];
  if (typeof date !== "string" || !DATE_RE.test(date))
    problems.push("date must be a string in YYYY-MM-DD format.");
  else if (Number.isNaN(Date.parse(`${date}T00:00:00Z`)))
    problems.push(`date "${date}" is not a real calendar date.`);
  if (!Array.isArray(assignments)) {
    problems.push("assignments must be an array.");
    return problems;
  }
  if (assignments.length === 0)
    problems.push("assignments must contain at least one assignment.");
  const seen = new Set<string>();
  assignments.forEach((a: unknown, i) => {
    const entry = (a ?? {}) as Record<string, unknown>;
    for (const field of ["rideId", "driverId", "vehicleId"] as const) {
      const id = entry[field];
      if (typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id))
        problems.push(`assignments[${i}].${field} must be a valid ObjectId.`);
    }
    if (typeof entry.rideId === "string") {
      if (seen.has(entry.rideId))
        problems.push(
          `assignments[${i}]: ride ${entry.rideId} is assigned more than once.`,
        );
      seen.add(entry.rideId);
    }
  });
  return problems;
}

function describeScheduleError(e: unknown, driverName: string, at: string) {
  if (e instanceof DriverNotAvailableException)
    return `${driverName} is not on shift at ${at}.`;
  if (e instanceof RouteReferenceNotFoundException) return `${e.message}.`;
  if (e instanceof BookingConflictException) return e.message;
  return `Unexpected error: ${e instanceof Error ? e.message : String(e)}`;
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest("Request body is not valid JSON.");
  }
  const problems = validateBody(body);
  if (problems.length) return badRequest("Invalid request.", problems);
  const { date, assignments } = body as {
    date: string;
    assignments: Assignment[];
  };

  try {
    // Validation and every write share one lock so concurrent applies or
    // manual bookings can't slip a conflicting ride in between.
    const results = await withSchedulingLock(
      schedulingLockKeys(assignments),
      () => applyAssignments(date, assignments),
    );
    return NextResponse.json(
      { results },
      { status: results.every((r) => r.success) ? HTTP_STATUS_CODE.OK : 207 },
    );
  } catch (e) {
    if (
      e instanceof AutoScheduleConflictError ||
      e instanceof SchedulingBusyException
    ) {
      return NextResponse.json(
        {
          error: e.message,
          details: e instanceof AutoScheduleConflictError ? e.details : [],
        },
        { status: HTTP_STATUS_CODE.CONFLICT },
      );
    }
    console.error("[POST /api/routes/auto-schedule]", e);
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}

async function applyAssignments(date: string, assignments: Assignment[]) {
  const plan = await planDay(date, assignments);
  const info = new Map(
    plan.drivers.flatMap((d) =>
      d.rides
        .filter((r) => r.kind === "proposed")
        .map((r) => [r.id, { ride: r, driverName: d.name }] as const),
    ),
  );

  const results = [];
  for (const a of assignments) {
    const found = info.get(a.rideId);
    const summary = {
      rideId: a.rideId,
      studentName: found?.ride.studentName ?? "Unknown student",
      pickup: found ? formatMinutes(found.ride.start) : "",
      driverName: found?.driverName ?? "Unknown driver",
      vehicleLabel: found?.ride.vehicleLabel ?? "",
    };
    try {
      const updated = await scheduleRouteWhileLocked(
        a.rideId,
        a.driverId,
        a.vehicleId,
      );
      results.push({
        ...summary,
        success: !!updated,
        error: updated
          ? undefined
          : "Ride is no longer requested; it may have been scheduled or cancelled.",
      });
    } catch (e) {
      console.error("[POST /api/routes/auto-schedule] ride", a.rideId, e);
      results.push({
        ...summary,
        success: false,
        error: describeScheduleError(e, summary.driverName, summary.pickup),
      });
    }
  }
  return results;
}
