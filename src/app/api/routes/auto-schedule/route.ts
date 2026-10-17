import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getUserFromRequest } from "@/utils/authUser";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";
import { scheduleRoute } from "@/server/db/actions/RouteAction";
import {
  planDay,
  AutoScheduleConflictError,
} from "@/server/scheduling/autoSchedule";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireAdmin() {
  try {
    const user = await getUserFromRequest();
    if (user.type === "Admin" || user.type === "SuperAdmin") return null;
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!DATE_RE.test(date)) {
    return NextResponse.json(
      { error: "date query param required (YYYY-MM-DD)" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
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

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: {
    date?: string;
    assignments?: { rideId: string; driverId: string; vehicleId: string }[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  const { date, assignments } = body;
  const validIds = (a: {
    rideId: string;
    driverId: string;
    vehicleId: string;
  }) =>
    [a.rideId, a.driverId, a.vehicleId].every((id) =>
      mongoose.Types.ObjectId.isValid(id),
    );
  if (
    !date ||
    !DATE_RE.test(date) ||
    !Array.isArray(assignments) ||
    assignments.length === 0 ||
    !assignments.every(validIds)
  ) {
    return NextResponse.json(
      { error: "date and a non-empty assignments array are required" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  try {
    await planDay(date, assignments);
    const results = [];
    for (const a of assignments) {
      try {
        const updated = await scheduleRoute(a.rideId, a.driverId, a.vehicleId);
        results.push({
          rideId: a.rideId,
          success: !!updated,
          error: updated ? undefined : "Ride is no longer requested",
        });
      } catch (e) {
        results.push({
          rideId: a.rideId,
          success: false,
          error: e instanceof Error ? e.message : "Failed to schedule",
        });
      }
    }
    return NextResponse.json(
      { results },
      { status: results.every((r) => r.success) ? HTTP_STATUS_CODE.OK : 207 },
    );
  } catch (e) {
    if (e instanceof AutoScheduleConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    console.error("[POST /api/routes/auto-schedule]", e);
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}
