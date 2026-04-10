import { NextRequest, NextResponse } from "next/server";
import Location from "@/server/db/models/LocationModel";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { getUserFromRequest } from "@/utils/authUser";

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
  try {
    const location = await Location.findById(id).lean();
    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    return NextResponse.json(location, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    console.error(
      "[GET /api/locations/:id]",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Failed to fetch location" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
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
  try {
    const deleted = await Location.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    return NextResponse.json(
      { message: "Location deleted successfully" },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (error) {
    console.error(
      "[DELETE /api/locations/:id]",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
