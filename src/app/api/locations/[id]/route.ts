import { NextRequest, NextResponse } from "next/server";
import Location from "@/server/db/models/LocationModel";
import { HTTP_STATUS_CODE } from "@/utils/consts";

// GET /api/locations/:id
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const location = await Location.findById(params.id);
    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    return NextResponse.json(location, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch location" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}

// DELETE /api/locations/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const location = await Location.findById(params.id);
    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    await location.deleteOne();
    return NextResponse.json(
      { message: "Location deleted successfully" },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
