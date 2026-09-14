import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { syncRidesToCalendar } from "@/server/google/syncRides";
import { getConnection } from "@/server/db/actions/GoogleCalendarAction";
import {
  handleGoogleRouteError,
  unauthorized,
} from "@/server/google/apiErrors";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { GoogleCalendarNotConnectedException } from "@/utils/exceptions/googleCalendar";

/** Reconcile the user's rides onto their selected calendar. */
export async function POST() {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return unauthorized();
  }

  try {
    const connection = await getConnection(user.userId);
    if (!connection) {
      throw new GoogleCalendarNotConnectedException();
    }

    const result = await syncRidesToCalendar(
      user.userId,
      user.type,
      connection.calendarId,
    );

    return NextResponse.json(result, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    return handleGoogleRouteError(e, user.userId, "calendar/sync");
  }
}

export const dynamic = "force-dynamic";
