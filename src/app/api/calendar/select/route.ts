import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { getAuthedClientForUser } from "@/server/google/oauthClient";
import { removeAllAppEvents } from "@/server/google/syncRides";
import {
  getConnection,
  setCalendarId,
} from "@/server/db/actions/GoogleCalendarAction";
import {
  handleGoogleRouteError,
  unauthorized,
} from "@/server/google/apiErrors";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { selectCalendarSchema } from "@/utils/types/googleCalendar";
import { GoogleCalendarNotConnectedException } from "@/utils/exceptions/googleCalendar";

/**
 * Point the user's sync at a different calendar.
 *
 * Clears our events off the *old* calendar first — otherwise switching would
 * strand a copy of every ride on a calendar the app no longer tracks, and the
 * user would have to delete them by hand.
 */
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return unauthorized();
  }

  try {
    const parsed = selectCalendarSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "calendarId is required" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }

    const { calendarId } = parsed.data;
    const connection = await getConnection(user.userId);
    if (!connection) {
      throw new GoogleCalendarNotConnectedException();
    }

    if (connection.calendarId === calendarId) {
      return NextResponse.json(
        { calendarId, removedFromPrevious: 0 },
        { status: HTTP_STATUS_CODE.OK },
      );
    }

    const client = await getAuthedClientForUser(user.userId);
    const removedFromPrevious = await removeAllAppEvents(
      client,
      connection.calendarId,
    );

    await setCalendarId(user.userId, calendarId);

    return NextResponse.json(
      { calendarId, removedFromPrevious },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (e) {
    return handleGoogleRouteError(e, user.userId, "calendar/select");
  }
}

export const dynamic = "force-dynamic";
