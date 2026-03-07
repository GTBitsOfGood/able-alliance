import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { createUser, getUsers } from "@/server/db/actions/UserAction";
import { baseUserSchema, studentSchema } from "@/utils/types/user";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { UserAlreadyExistsException } from "@/utils/exceptions/user";
import { internalErrorPayload } from "@/utils/apiError";

export async function GET(request: NextRequest) {
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
  try {
    const searchParams = request.nextUrl.searchParams;
    //so you can filter by the type of user
    const type = searchParams.get("type") as
      | "Student"
      | "Driver"
      | "Admin"
      | "SuperAdmin"
      | null;

    const users = await getUsers(type || undefined);
    return NextResponse.json(users, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}

export async function POST(request: NextRequest) {
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
  try {
    const body = await request.json();
    let parsed;

    if (body.type === "Student") {
      parsed = studentSchema.safeParse(body);
    } else {
      parsed = baseUserSchema.safeParse(body);
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

    const created = await createUser(parsed.data);
    const createdObj = created as Record<string, unknown> & {
      _id: { toString(): string };
    };
    return NextResponse.json(
      { ...createdObj, _id: createdObj._id.toString() },
      { status: HTTP_STATUS_CODE.CREATED },
    );
  } catch (e) {
    if (e instanceof UserAlreadyExistsException) {
      return NextResponse.json({ error: e.message }, { status: e.code });
    }
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}
