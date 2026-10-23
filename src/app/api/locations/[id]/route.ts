import { NextRequest, NextResponse } from "next/server";
import {
  deleteLocation,
  getLocationById,
} from "@/server/db/actions/LocationAction";
import { isValidId } from "@/utils/ids";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { getUserFromRequest } from "@/utils/authUser";
import { errorResponse } from "@/utils/errors";

// GET /api/locations/:id
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  const { id } = await context.params; // Await params before accessing id
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid location ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    const location = await getLocationById(id);
    return NextResponse.json(location, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/locations/:id
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
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
  const { id } = await context.params; // Await params before accessing id
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid location ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    await deleteLocation(id);
    return NextResponse.json(
      { message: "Location deleted successfully" },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
