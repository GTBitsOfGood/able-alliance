/**
 * Google OAuth wiring for the calendar sync feature.
 *
 * We store only the refresh token (encrypted, see ./tokenCrypto). Access tokens
 * are short-lived, so the OAuth2 client mints a fresh one per request from the
 * refresh token rather than us persisting and expiring them ourselves.
 */

import { auth } from "@googleapis/calendar";
import { decryptToken } from "./tokenCrypto";
import { getRefreshToken } from "@/server/db/actions/GoogleCalendarAction";
import {
  GoogleCalendarConfigException,
  GoogleCalendarNotConnectedException,
} from "@/utils/exceptions/googleCalendar";

export type GoogleOAuthClient = InstanceType<typeof auth.OAuth2>;

/**
 * calendar.events    — create/update/delete the ride events we own
 * calendarlist.readonly — populate the "which calendar?" dropdown
 * openid + email     — show which Google account is connected
 *
 * Deliberately NOT the full `calendar` scope: we never need to create, rename,
 * or delete entire calendars.
 */
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "openid",
  "email",
];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new GoogleCalendarConfigException(
      `${name} environment variable is required for Google Calendar sync`,
    );
  }
  return value;
}

/** A bare client with no credentials — used for the consent URL and code exchange. */
export function makeOAuthClient(): GoogleOAuthClient {
  return new auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI"),
  );
}

/**
 * Build the Google consent screen URL.
 *
 * `access_type: "offline"` asks for a refresh token, and `prompt: "consent"`
 * forces Google to re-issue one on every authorization. Without the latter,
 * Google returns a refresh token only the *first* time a user ever approves the
 * app — so a reconnect after disconnecting would silently come back with no
 * refresh token and the connection would be write-once.
 */
export function buildConsentUrl(state: string): string {
  return makeOAuthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_CALENDAR_SCOPES,
    include_granted_scopes: true,
    state,
  });
}

/**
 * Load the user's stored refresh token into a ready-to-use client.
 * Throws if the user has never connected.
 */
export async function getAuthedClientForUser(
  userId: string,
): Promise<GoogleOAuthClient> {
  const encrypted = await getRefreshToken(userId);
  if (!encrypted) {
    throw new GoogleCalendarNotConnectedException();
  }

  const client = makeOAuthClient();
  client.setCredentials({ refresh_token: decryptToken(encrypted) });
  return client;
}

/**
 * True when Google rejected our refresh token outright (revoked by the user,
 * expired, or the OAuth client changed). Google signals all of these as
 * `invalid_grant`, and retrying will never succeed — the caller should clear the
 * connection instead of surfacing a generic 500.
 */
export function isInvalidGrantError(e: unknown): boolean {
  if (!e || typeof e !== "object") {
    return false;
  }

  const err = e as {
    message?: string;
    response?: { data?: { error?: string } };
  };

  return (
    err.response?.data?.error === "invalid_grant" ||
    (typeof err.message === "string" && err.message.includes("invalid_grant"))
  );
}
