import { NextRequest, NextResponse } from "next/server";
import {
  createLocation,
  getLocations,
} from "@/server/db/actions/LocationAction";
import { locationSchema } from "@/utils/types";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { ArgumentError, errorResponse } from "@/utils/errors";

// GET /api/locations
// Retrieves all locations
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
    const locations = await getLocations();

    return NextResponse.json(locations, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/locations
// Creates a new location
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
  if (!isAdmin(user.type)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }
  try {
    const body = await request.json().catch(() => {
      throw new ArgumentError("Invalid JSON body");
    });
    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(parsed.error.format(), {
        status: HTTP_STATUS_CODE.BAD_REQUEST,
      });
    }

    const created = await createLocation(parsed.data);
    return NextResponse.json(created, { status: HTTP_STATUS_CODE.CREATED });
  } catch (e) {
    return errorResponse(e);
  }
}
