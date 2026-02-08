import { NextRequest, NextResponse } from "next/server";
import { getUserById, deleteUser } from "@/server/db/actions/UserAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { UserNotFoundException } from "@/utils/exceptions/user";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getUserById(params.id);
    const userObj = user as Record<string, unknown> & {
      _id: { toString(): string };
    };
    return NextResponse.json(
      { ...userObj, _id: userObj._id.toString() },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (e) {
    if (e instanceof UserNotFoundException) {
      return NextResponse.json({ error: e.message }, { status: e.code });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const deleted = await deleteUser(params.id);
    const deletedObj = deleted as Record<string, unknown> & {
      _id: { toString(): string };
    };
    return NextResponse.json(
      { ...deletedObj, _id: deletedObj._id.toString() },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (e) {
    if (e instanceof UserNotFoundException) {
      return NextResponse.json({ error: e.message }, { status: e.code });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}

