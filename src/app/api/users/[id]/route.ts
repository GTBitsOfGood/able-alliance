import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import mongoose from "mongoose";
import { getUserById, deleteUser } from "@/server/db/actions/UserAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let authUser;
  try {
    authUser = await getUserFromRequest();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid user ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    // Only allow: Admin/SuperAdmin, or self
    if (
      authUser.type === "Admin" ||
      authUser.type === "SuperAdmin" ||
      user._id?.toString() === authUser.userId
    ) {
      const userObj = user as Record<string, unknown> & {
        _id: { toString(): string };
      };
      return NextResponse.json(
        { ...userObj, _id: userObj._id.toString() },
        { status: HTTP_STATUS_CODE.OK },
      );
    }
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  } catch (e) {
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let authUser;
  try {
    authUser = await getUserFromRequest();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid user ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    const user = await getUserById(id);
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    if (
      (authUser.type !== "Admin" && authUser.type !== "SuperAdmin") ||
      ((user.type === "Admin" || user.type === "SuperAdmin") &&
        authUser.type !== "SuperAdmin")
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }
    const deleted = await deleteUser(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "User not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    return NextResponse.json(
      { message: "User deleted" },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (e) {
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}
