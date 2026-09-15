/**
 * Shared error translation for the /api/calendar routes.
 *
 * The main job is turning Google's `invalid_grant` into a clean "reconnect"
 * signal: it means our stored refresh token is dead (user revoked access, or it
 * expired), so we clear the connection instead of leaving the UI claiming to be
 * connected while every sync 500s.
 */

import { NextResponse } from "next/server";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";
import { clearConnection } from "@/server/db/actions/GoogleCalendarAction";
import { isInvalidGrantError } from "./oauthClient";
import {
  GoogleCalendarAccessRevokedException,
  GoogleCalendarConfigException,
  GoogleCalendarNotConnectedException,
} from "@/utils/exceptions/googleCalendar";

export async function handleGoogleRouteError(
  e: unknown,
  userId: string,
  context: string,
): Promise<NextResponse> {
  if (isInvalidGrantError(e)) {
    console.warn(`[${context}] refresh token rejected; clearing connection`);
    await clearConnection(userId);
    const revoked = new GoogleCalendarAccessRevokedException();
    return NextResponse.json(
      { error: revoked.message, code: "reconnect_required" },
      { status: revoked.code },
    );
  }

  if (e instanceof GoogleCalendarNotConnectedException) {
    return NextResponse.json(
      { error: e.message, code: "not_connected" },
      { status: e.code },
    );
  }

  if (e instanceof GoogleCalendarConfigException) {
    console.error(`[${context}] server misconfiguration:`, e);
    return NextResponse.json(
      { error: e.message },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }

  console.error(`[${context}] unexpected error:`, e);
  return NextResponse.json(internalErrorPayload(e), {
    status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
  });
}

export function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: HTTP_STATUS_CODE.UNAUTHORIZED },
  );
}
