import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { scheduleRoute } from "@/server/db/actions/RouteAction";
import { isValidId } from "@/utils/ids";
import { z } from "zod";
import { HttpError, errorResponse } from "@/utils/errors";

const bulkAssignmentSchema = z
  .object({
    rides: z
      .array(z.object({ rideId: z.string(), vehicleId: z.string() }).strict())
      .min(1),
  })
  .strict();

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ driverId: string }> },
) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  if (user.type !== "Admin" && user.type !== "SuperAdmin") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }

  const { driverId: rawDriverId } = await params;
  const driverId = rawDriverId.toLowerCase();
  if (!isValidId(driverId)) {
    return NextResponse.json(
      { error: "Invalid driver ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  const parsedBody = bulkAssignmentSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "rides array is required and must not be empty" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  for (const r of parsedBody.data.rides) {
    if (!isValidId(r.rideId)) {
      return NextResponse.json(
        { error: `Invalid rideId: ${r.rideId}` },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    if (!isValidId(r.vehicleId)) {
      return NextResponse.json(
        { error: `Invalid vehicleId for ride ${r.rideId}` },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
  }

  try {
    const results: Array<{ rideId: string; success: boolean; error?: string }> =
      [];

    for (const { rideId, vehicleId } of parsedBody.data.rides) {
      try {
        await scheduleRoute(rideId, driverId, vehicleId);
        results.push({ rideId, success: true });
      } catch (error) {
        if (!(error instanceof HttpError) || error.statusCode >= 500)
          throw error;
        results.push({
          rideId,
          success: false,
          error: error instanceof Error ? error.message : "Assignment failed",
        });
      }
    }

    const allSucceeded = results.every((r) => r.success);
    return NextResponse.json(
      { results },
      { status: allSucceeded ? HTTP_STATUS_CODE.OK : 207 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
