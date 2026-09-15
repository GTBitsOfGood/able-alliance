import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import {
  getAuthedClientForUser,
  isInvalidGrantError,
} from "@/server/google/oauthClient";
import { removeAllAppEvents } from "@/server/google/syncRides";
import {
  clearConnection,
  getConnection,
} from "@/server/db/actions/GoogleCalendarAction";
import {
  handleGoogleRouteError,
  unauthorized,
} from "@/server/google/apiErrors";
import { HTTP_STATUS_CODE } from "@/utils/consts";

/**
 * Disconnect the Google account.
 *
 * Order matters: clean the events off the calendar and revoke the grant at
 * Google *before* dropping our copy of the token, since both need it. Every
 * remote step is best-effort — if Google is unreachable we still clear the local
 * connection, because a user clicking "Disconnect" should never be left connected.
 */
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
      return NextResponse.json(
        { disconnected: true, removedEvents: 0 },
        { status: HTTP_STATUS_CODE.OK },
      );
    }

    let removedEvents = 0;

    try {
      const client = await getAuthedClientForUser(user.userId);
      removedEvents = await removeAllAppEvents(client, connection.calendarId);

      const refreshToken = client.credentials.refresh_token;
      if (refreshToken) {
        await client.revokeToken(refreshToken);
      }
    } catch (e) {
      if (!isInvalidGrantError(e)) {
        // Already-revoked tokens are the expected case here; anything else is
        // worth knowing about, but still shouldn't block the disconnect.
        console.warn("[calendar/disconnect] remote cleanup failed:", e);
      }
    }

    await clearConnection(user.userId);

    return NextResponse.json(
      { disconnected: true, removedEvents },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (e) {
    return handleGoogleRouteError(e, user.userId, "calendar/disconnect");
  }
}

export const dynamic = "force-dynamic";
