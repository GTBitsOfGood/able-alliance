import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { vehicleSchema } from "@/utils/types/vehicle";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { createVehicle, getVehicles } from "@/server/db/actions/VehicleAction";
import { ArgumentError, errorResponse } from "@/utils/errors";

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  if (!isAdmin(user.type)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }
  try {
    const body = await req.json().catch(() => {
      throw new ArgumentError("Invalid JSON body");
    });
    const parsed = vehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    const vehicle = await createVehicle(parsed.data);
    return NextResponse.json(vehicle, { status: HTTP_STATUS_CODE.CREATED });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET() {
  try {
    await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  try {
    const vehicles = await getVehicles();
    return NextResponse.json(vehicles);
  } catch (error) {
    return errorResponse(error);
  }
}
