import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getRouteById, deleteRouteById } from "@/server/db/actions/RouteAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid route ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    const route = await getRouteById(id);
    if (!route) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    return NextResponse.json(route, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid route ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    const deleted = await deleteRouteById(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Route not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    return NextResponse.json(
      { message: "Route deleted" },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
