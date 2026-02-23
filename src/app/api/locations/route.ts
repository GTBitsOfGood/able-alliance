import { NextRequest, NextResponse } from "next/server";
import {
  createLocation,
  getLocations,
} from "@/server/db/actions/LocationAction";
import { locationSchema } from "@/utils/types";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { LocationAlreadyExistsException } from "@/utils/exceptions/location";
import { EmailTemplates } from "@/server/db/actions/EmailAction";

// GET /api/locations
// Retrieves all locations
export async function GET() {
  try {
    const locations = await getLocations();

    return NextResponse.json(locations, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    if (e instanceof LocationAlreadyExistsException) {
      return NextResponse.json({ error: e.message }, { status: e.code });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}

// POST /api/locations
// Creates a new location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = locationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(parsed.error.format(), {
        status: HTTP_STATUS_CODE.BAD_REQUEST,
      });
    }

    const created = await createLocation(parsed.data);
    const createdObj = created as Record<string, unknown> & {
      _id: { toString(): string };
    };
    return NextResponse.json(
      { ...createdObj, _id: createdObj._id.toString() },
      { status: HTTP_STATUS_CODE.CREATED },
    );
  } catch (e) {
    if (e instanceof LocationAlreadyExistsException) {
      return NextResponse.json({ error: e.message }, { status: e.code });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
