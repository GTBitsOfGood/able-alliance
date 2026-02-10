import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getUserById, deleteUser } from "@/server/db/actions/UserAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
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
    const userObj = user as Record<string, unknown> & {
      _id: { toString(): string };
    };
    return NextResponse.json(
      { ...userObj, _id: userObj._id.toString() },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (e) {
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid user ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
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
