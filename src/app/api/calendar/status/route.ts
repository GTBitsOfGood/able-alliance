import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { getConnection } from "@/server/db/actions/GoogleCalendarAction";
import {
  handleGoogleRouteError,
  unauthorized,
} from "@/server/google/apiErrors";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import type { GoogleCalendarStatus } from "@/utils/types/googleCalendar";

/** Current connection state for the /calendar page. Never touches the Google API. */
export async function GET() {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return unauthorized();
  }

  try {
    const connection = await getConnection(user.userId);

    const status: GoogleCalendarStatus = connection
      ? {
          connected: true,
          calendarId: connection.calendarId,
          googleEmail: connection.googleEmail ?? null,
          connectedAt: connection.connectedAt?.toISOString() ?? null,
          lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
          syncedEventCount: connection.syncedEventCount,
        }
      : {
          connected: false,
          calendarId: null,
          googleEmail: null,
          connectedAt: null,
          lastSyncedAt: null,
          syncedEventCount: 0,
        };

    return NextResponse.json(status, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    return handleGoogleRouteError(e, user.userId, "calendar/status");
  }
}

export const dynamic = "force-dynamic";
