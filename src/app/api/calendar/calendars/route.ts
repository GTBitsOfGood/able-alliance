import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { getAuthedClientForUser } from "@/server/google/oauthClient";
import { listUserCalendars } from "@/server/google/syncRides";
import {
  handleGoogleRouteError,
  unauthorized,
} from "@/server/google/apiErrors";
import { HTTP_STATUS_CODE } from "@/utils/consts";

/** Writable calendars for the picker dropdown. */
export async function GET() {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return unauthorized();
  }

  try {
    const client = await getAuthedClientForUser(user.userId);
    const calendars = await listUserCalendars(client);
    return NextResponse.json({ calendars }, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    return handleGoogleRouteError(e, user.userId, "calendar/calendars");
  }
}

export const dynamic = "force-dynamic";
