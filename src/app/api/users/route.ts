import type { UserType } from "@db/generated/browser";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
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
  if (user.type !== "Admin" && user.type !== "SuperAdmin") {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }
  try {
    const searchParams = request.nextUrl.searchParams;
    //so you can filter by the type of user
    const type = searchParams.get("type") as UserType | null;

    const users = await getUsers(type || undefined);
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
  if (user.type !== "Admin" && user.type !== "SuperAdmin") {
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
      email:
        typeof username === "string" ? `${username}@gatech.edu` : undefined,
    };
    let parsed;

    if (body.type === "Student") {
      parsed = studentSchema.safeParse(userData);
    } else {
      parsed = baseUserSchema.safeParse(userData);
    }

    if (!parsed.success) {
      return NextResponse.json(parsed.error.format(), {
        status: HTTP_STATUS_CODE.BAD_REQUEST,
      });
    }

    if (
      user.type !== "SuperAdmin" &&
      (parsed.data.type == "Admin" || parsed.data.type == "SuperAdmin")
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: HTTP_STATUS_CODE.FORBIDDEN },
      );
    }

    const data = parsed.data;
    const studentInfo =
      data.type === "Student" ? (data as StudentInput).studentInfo : undefined;
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
      type: data.type,
      settings: { create: data.settings ?? {} },
      ...(studentInfo
        ? {
            studentInfo: {
              create: {
                notes: studentInfo.notes,
                accessibilityNeeds: {
                  connect: (studentInfo.accessibilityNeeds ?? []).map(
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
