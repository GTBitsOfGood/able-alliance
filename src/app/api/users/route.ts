import { hasAdminType } from "@/utils/userTypes";
import { UserType } from "@db/generated/enums";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { createUser, getUsers } from "@/server/db/actions/UserAction";
import {
  baseUserSchema,
  studentSchema,
  type StudentInput,
} from "@/utils/types/user";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { findInvalidAccommodations } from "@/server/db/actions/AccommodationAction";
import { ArgumentError, errorResponse } from "@/utils/errors";

export async function GET(request: NextRequest) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  if (!isAdmin(user.activeType)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }
  try {
    const searchParams = request.nextUrl.searchParams;
    //so you can filter by the type of user
    const type = searchParams.get("type");
    const parsedType = type ? z.enum(UserType).safeParse(type) : null;
    if (parsedType && !parsedType.success)
      throw new ArgumentError("Invalid user type");
    const users = await getUsers(parsedType?.data);
    return NextResponse.json(users, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  if (!isAdmin(user.activeType)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }
  try {
    const body = await request.json().catch(() => {
      throw new ArgumentError("Invalid JSON body");
    });
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    const username =
      typeof body.username === "string"
        ? body.username.trim().toLowerCase()
        : body.username;
    const userData = {
      ...body,
      username,
    };
    let parsed;

    if (Array.isArray(body.types) && body.types.includes("Student")) {
      parsed = studentSchema.safeParse(userData);
    } else {
      parsed = baseUserSchema.safeParse(userData);
    }

    if (!parsed.success) {
      return NextResponse.json(parsed.error.format(), {
        status: HTTP_STATUS_CODE.BAD_REQUEST,
      });
    }

    if (user.activeType !== "SuperAdmin" && hasAdminType(parsed.data)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }

    const data = parsed.data;
    const studentInfo = data.types.includes("Student")
      ? (data as StudentInput).studentInfo
      : undefined;
    if (studentInfo?.accessibilityNeeds?.length) {
      const invalid = await findInvalidAccommodations(
        studentInfo.accessibilityNeeds,
      );
      if (invalid.length) {
        return NextResponse.json(
          { error: `Invalid accommodations: ${invalid.join(", ")}` },
          { status: HTTP_STATUS_CODE.BAD_REQUEST },
        );
      }
    }
    const created = await createUser({
      firstName: data.firstName,
      lastName: data.lastName,
      preferredName: data.preferredName,
      username: data.username,
      email: data.email,
      types: data.types,
      settings: { create: data.settings ?? {} },
      ...(data.types.includes("Student")
        ? {
            studentInfo: {
              create: {
                notes: studentInfo?.notes,
                accessibilityNeeds: {
                  connect: (studentInfo?.accessibilityNeeds ?? []).map(
                    (label) => ({ label }),
                  ),
                },
              },
            },
          }
        : {}),
    });
    return NextResponse.json(created, { status: HTTP_STATUS_CODE.CREATED });
  } catch (error) {
    return errorResponse(error);
  }
}
