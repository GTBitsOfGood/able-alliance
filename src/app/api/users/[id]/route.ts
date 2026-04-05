import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import mongoose from "mongoose";
import {
  getUserById,
  deleteUser,
  updateStudentInfo,
  updateDriverShifts,
} from "@/server/db/actions/UserAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";
import { auth } from "@/auth";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let authUser;
  try {
    authUser = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
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

const studentInfoPatchSchema = z
  .object({
    notes: z.string().max(2000).nullable().optional(),
    accessibilityNeeds: z
      .enum(["Wheelchair", "LowMobility"])
      .nullable()
      .optional(),
  })
  .strict();

const driverShiftsPatchSchema = z
  .object({
    shifts: z
      .array(
        z
          .object({
            dayOfWeek: z.number().int().min(0).max(6),
            startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
            endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
          })
          .refine((shift) => shift.startTime < shift.endTime, {
            message: "Start time must be before end time",
            path: ["startTime"],
          }),
      )
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

  // Get the user to determine type
  const user = await getUserById(id);
  if (!user) {
    return NextResponse.json(
      { error: "User not found" },
      { status: HTTP_STATUS_CODE.NOT_FOUND },
    );
  }

  try {
    let updated;
    if (user.type === "Student") {
      const parsed = studentInfoPatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(parsed.error.format(), {
          status: HTTP_STATUS_CODE.BAD_REQUEST,
        });
      }
      updated = await updateStudentInfo(id, {
        notes: parsed.data.notes ?? null,
        accessibilityNeeds: parsed.data.accessibilityNeeds ?? null,
      });
    } else if (user.type === "Driver") {
      // For drivers, only admins can update shifts
      if (!isAdmin) {
        return NextResponse.json(
          { error: "Only admins can update driver shifts" },
          { status: HTTP_STATUS_CODE.FORBIDDEN },
        );
      }
      const parsed = driverShiftsPatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(parsed.error.format(), {
          status: HTTP_STATUS_CODE.BAD_REQUEST,
        });
      }
      updated = await updateDriverShifts(id, parsed.data.shifts ?? []);
    } else {
      return NextResponse.json(
        { error: "Cannot update this user type" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }

    if (!updated) {
      return NextResponse.json(
        { error: "User not found or update failed" },
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
  let authUser;
  try {
    authUser = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
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
