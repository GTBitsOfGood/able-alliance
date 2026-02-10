import { NextRequest, NextResponse } from "next/server";
import { vehicleSchema } from "@/utils/types/vehicle";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { createVehicle, getVehicles } from "@/server/db/actions/VehicleAction";
import { VehicleAlreadyExistsException } from "@/utils/exceptions/vehicle";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = vehicleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    try {
      const vehicle = await createVehicle(parsed.data);
      return NextResponse.json(vehicle, { status: HTTP_STATUS_CODE.CREATED });
    } catch (err) {
      if (err instanceof VehicleAlreadyExistsException) {
        return NextResponse.json({ error: err.message }, { status: err.code });
      }
      return NextResponse.json(
        { error: "Internal server error" },
        { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
      );
    }
  } catch (_e) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}

export async function GET() {
  try {
    const vehicles = await getVehicles();
    return NextResponse.json(vehicles);
  } catch (e) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
