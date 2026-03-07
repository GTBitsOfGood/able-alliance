import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import mongoose from "mongoose";
import { getRouteById, deleteRouteById } from "@/server/db/actions/RouteAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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
    // Only allow: Admin/SuperAdmin, or owner (student._id or driver._id matches userId)
    if (
      user.type === "Admin" ||
      user.type === "SuperAdmin" ||
      (route.student &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (route.student as any)._id?.toString() === user.userId) ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (route.driver && (route.driver as any)._id?.toString() === user.userId)
    ) {
      return NextResponse.json(route, { status: HTTP_STATUS_CODE.OK });
    }
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.type !== "Admin" && user.type !== "SuperAdmin") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }
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
