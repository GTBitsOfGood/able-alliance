import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import {
  getUserById,
  deleteUser,
  updateStudentInfo,
} from "@/server/db/actions/UserAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";
import { auth } from "@/auth";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

const studentInfoPatchSchema = z
  .object({
    notes: z.string().max(2000).nullable().optional(),
    accessibilityNeeds: z
      .enum(["Wheelchair", "LowMobility"])
      .nullable()
      .optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid user ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  const session = await auth();
  const viewer = session?.user;
  if (!viewer) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }

  const viewerType = viewer.type as string;
  const viewerId = viewer.userId as string;

  const isSelf = viewerId === id;
  const isAdmin = viewerType === "Admin" || viewerType === "SuperAdmin";

  if (!isSelf && !isAdmin) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  const parsed = studentInfoPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.format(), {
      status: HTTP_STATUS_CODE.BAD_REQUEST,
    });
  }

  try {
    const updated = await updateStudentInfo(id, {
      notes: parsed.data.notes ?? null,
      accessibilityNeeds: parsed.data.accessibilityNeeds ?? null,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "User not found or not a student" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }

    const userObj = updated as unknown as Record<string, unknown> & {
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
  { params }: { params: Promise<{ id: string }> },
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
