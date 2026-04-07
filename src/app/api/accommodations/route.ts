import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import {
  getAccommodations,
  createAccommodation,
} from "@/server/db/actions/AccommodationAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";
import { z } from "zod";

export async function GET() {
  try {
    await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  try {
    const accommodations = await getAccommodations();
    return NextResponse.json(accommodations, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}

const createSchema = z.object({ label: z.string().min(1).max(200) });

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
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(parsed.error.format(), {
      status: HTTP_STATUS_CODE.BAD_REQUEST,
    });
  }
  try {
    const created = await createAccommodation(parsed.data.label);
    return NextResponse.json(created, { status: HTTP_STATUS_CODE.CREATED });
  } catch (e) {
    if (e instanceof Error && e.message.includes("already exists")) {
      return NextResponse.json(
        { error: e.message },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}
