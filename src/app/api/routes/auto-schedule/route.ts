import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@db/generated/client";
import { isValidId } from "@/utils/ids";
import { getUserFromRequest } from "@/utils/authUser";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { HttpError, errorResponse } from "@/utils/errors";
import {
  schedulingLockKeys,
  scheduleRouteWhileLocked,
  withSchedulingLock,
} from "@/server/db/actions/RouteAction";
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
    return errorResponse(e);
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
      if (typeof id !== "string" || !isValidId(id))
        problems.push(`assignments[${i}].${field} must be a valid UUID.`);
    }
    if (typeof entry.rideId === "string") {
      if (seen.has(entry.rideId.toLowerCase()))
        problems.push(
          `assignments[${i}]: ride ${entry.rideId} is assigned more than once.`,
        );
      seen.add(entry.rideId.toLowerCase());
    }
  });
  return problems;
}

function describeScheduleError(e: unknown) {
  if (e instanceof HttpError) return e.message;
  return "Unexpected scheduling error.";
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
  const { date, assignments: rawAssignments } = body as {
    date: string;
    assignments: Assignment[];
  };

  const assignments = rawAssignments.map((a) => ({
    rideId: a.rideId.toLowerCase(),
    driverId: a.driverId.toLowerCase(),
    vehicleId: a.vehicleId.toLowerCase(),
  }));
  try {
    // Validation and every write share one lock so concurrent applies or
    // manual bookings can't slip a conflicting ride in between.
    const results = await withSchedulingLock(
      schedulingLockKeys(assignments),
      (tx, afterCommit) => applyAssignments(date, assignments, tx, afterCommit),
    );
    return NextResponse.json(
      { results },
      { status: results.every((r) => r.success) ? HTTP_STATUS_CODE.OK : 207 },
    );
  } catch (e) {
    if (e instanceof AutoScheduleConflictError || e instanceof HttpError) {
      return NextResponse.json(
        {
          error: e.message,
          details: e instanceof AutoScheduleConflictError ? e.details : [],
        },
        { status: HTTP_STATUS_CODE.CONFLICT },
      );
    }
    console.error("[POST /api/routes/auto-schedule]", e);
    return errorResponse(e);
  }
}

async function applyAssignments(
  date: string,
  assignments: Assignment[],
  tx: Prisma.TransactionClient,
  afterCommit: (() => void)[],
) {
  const plan = await planDay(date, assignments, tx);
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
        tx,
        afterCommit,
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
        error: describeScheduleError(e),
      });
    }
  }
  return results;
}
