import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { isValidId } from "@/utils/ids";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { vehicleSchema } from "@/utils/types/vehicle";
import {
  archiveVehicle,
  getVehicleById,
  updateVehicle,
} from "@/server/db/actions/VehicleAction";
import { ArgumentError, errorResponse } from "@/utils/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid vehicle ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    const vehicle = await getVehicleById(id);
    return NextResponse.json(vehicle, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
  if (!isAdmin(user.type)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid vehicle ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    await archiveVehicle(id);
    return NextResponse.json(
      { message: "Vehicle archived" },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
  if (!isAdmin(user.type)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid vehicle ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    const body = await req.json().catch(() => {
      throw new ArgumentError("Invalid JSON body");
    });
    const parsed = vehicleSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    const updated = await updateVehicle(id, parsed.data);
    return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    return errorResponse(error);
  }
}
