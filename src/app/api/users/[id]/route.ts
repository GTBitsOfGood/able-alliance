import { hasAdminType, hasUserType } from "@/utils/userTypes";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { isValidId } from "@/utils/ids";
import {
  getUserById,
  archiveUser,
  updateUser,
} from "@/server/db/actions/UserAction";
import { findInvalidAccommodations } from "@/server/db/actions/AccommodationAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { errorResponse } from "@/utils/errors";
import { z } from "zod";
import { notificationSettingsSchema, shiftSchema } from "@/utils/types/user";

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
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid user ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    const user = await getUserById(id);
    // Only allow: Admin/SuperAdmin, or self
    if (isAdmin(authUser.activeType) || user.id === authUser.userId) {
      return NextResponse.json(user, { status: HTTP_STATUS_CODE.OK });
    }
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

const studentInfoPatchSchema = z
  .object({
    preferredName: z.string().max(100).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    accessibilityNeeds: z.array(z.string().min(1)).nullable().optional(),
    settings: notificationSettingsSchema.optional(),
  })
  .strict();

const driverShiftsPatchSchema = z
  .object({
    shifts: z.array(shiftSchema).optional(),
    settings: notificationSettingsSchema.optional(),
  })
  .strict();

const settingsPatchSchema = z
  .object({ settings: notificationSettingsSchema.optional() })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid user ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  const viewer = await getUserFromRequest().catch(() => null);
  if (!viewer) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }

  const viewerType = viewer.activeType as string;
  const viewerId = viewer.userId as string;

  const isSelf = viewerId === id;
  const viewerIsAdmin = isAdmin(viewerType);

  if (!isSelf && !viewerIsAdmin) {
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

  try {
    const user = await getUserById(id);
    // Notification settings belong to the account, regardless of role order.
    const settingsPatch = settingsPatchSchema.safeParse(body);
    if (settingsPatch.success && settingsPatch.data.settings !== undefined) {
      const updated = await updateUser(
        id,
        isSelf ? viewer.activeType : user.types[0],
        settingsPatch.data,
      );
      return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
    }

    const profileRole =
      typeof body === "object" && body !== null && "shifts" in body
        ? "Driver"
        : hasUserType(user, "Student")
          ? "Student"
          : user.types[0];
    if (!hasUserType(user, profileRole)) {
      return NextResponse.json(
        { error: "User does not have this type" },
        { status: 400 },
      );
    }
    let parsed;
    if (profileRole === "Student") {
      parsed = studentInfoPatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(parsed.error.format(), {
          status: HTTP_STATUS_CODE.BAD_REQUEST,
        });
      }
      const { accessibilityNeeds } = parsed.data;
      if (accessibilityNeeds && accessibilityNeeds.length > 0) {
        const invalid = await findInvalidAccommodations(accessibilityNeeds);
        if (invalid.length > 0) {
          return NextResponse.json(
            { error: `Invalid accommodations: ${invalid.join(", ")}` },
            { status: HTTP_STATUS_CODE.BAD_REQUEST },
          );
        }
      }
      const updated = await updateUser(id, "Student", parsed.data);
      return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
    } else if (profileRole === "Driver") {
      // For drivers, only admins can update shifts
      if (
        !viewerIsAdmin &&
        typeof body === "object" &&
        body !== null &&
        "shifts" in body
      ) {
        return NextResponse.json(
          { error: "Only admins can update driver shifts" },
          { status: HTTP_STATUS_CODE.FORBIDDEN },
        );
      }
      parsed = driverShiftsPatchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(parsed.error.format(), {
          status: HTTP_STATUS_CODE.BAD_REQUEST,
        });
      }
      const updated = await updateUser(id, "Driver", parsed.data);
      return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
    } else {
      if (!viewerIsAdmin)
        return NextResponse.json(
          { error: "Cannot update this user type" },
          { status: HTTP_STATUS_CODE.BAD_REQUEST },
        );
      const adminParsed = settingsPatchSchema.safeParse(body);
      if (!adminParsed.success)
        return NextResponse.json(adminParsed.error.format(), {
          status: HTTP_STATUS_CODE.BAD_REQUEST,
        });
      const updated = await updateUser(id, profileRole, adminParsed.data);
      return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
    }
  } catch (error) {
    return errorResponse(error);
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
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid user ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    const user = await getUserById(id);
    if (
      !isAdmin(authUser.activeType) ||
      (hasAdminType(user) && authUser.activeType !== "SuperAdmin")
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }
    if (user.type === "SuperAdmin") {
      return NextResponse.json(
        { error: "Super admins cannot be archived" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }
    await archiveUser(id);
    return NextResponse.json(
      { message: "User archived" },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
