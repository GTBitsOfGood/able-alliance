import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromRequest } from "@/utils/authUser";
import { makeOAuthClient } from "@/server/google/oauthClient";
import { encryptToken } from "@/server/google/tokenCrypto";
import {
  getConnection,
  saveConnection,
} from "@/server/db/actions/GoogleCalendarAction";
import { OAUTH_STATE_COOKIE } from "@/server/google/oauthState";

/** Resolve the app origin the same way auth.ts does, so redirects work behind Netlify. */
function appOrigin(req: NextRequest): string {
  return (
    process.env.DEPLOY_PRIME_URL ??
    process.env.NEXTAUTH_URL ??
    req.nextUrl.origin
  );
}

function redirectToCalendar(req: NextRequest, params: Record<string, string>) {
  const url = new URL("/calendar", appOrigin(req));
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = NextResponse.redirect(url);
  // The nonce is single-use either way.
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

/** Constant-time compare so the state check can't be probed byte by byte. */
function statesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Google redirects here after the consent screen. Exchanges the auth code for a
 * refresh token, encrypts it, and stores it on the user.
 *
 * Everything fails closed to /calendar?error=... — this endpoint is a browser
 * navigation target, so a raw JSON error body would just be dumped on screen.
 */
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.redirect(new URL("/login", appOrigin(req)));
  }

  const { searchParams } = req.nextUrl;

  // The user hit "Cancel" on Google's consent screen.
  const oauthError = searchParams.get("error");
  if (oauthError) {
    return redirectToCalendar(req, { error: oauthError });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code) {
    return redirectToCalendar(req, { error: "missing_code" });
  }
  if (!state || !expectedState || !statesMatch(state, expectedState)) {
    return redirectToCalendar(req, { error: "invalid_state" });
  }

  try {
    const client = makeOAuthClient();
    const { tokens } = await client.getToken(code);

    // buildConsentUrl always sends prompt=consent, so Google should always return
    // a refresh token here. If it didn't, storing the connection would leave us
    // with a write-once account we can never refresh.
    if (!tokens.refresh_token) {
      return redirectToCalendar(req, { error: "no_refresh_token" });
    }

    let googleEmail: string | undefined;
    if (tokens.access_token) {
      try {
        const info = await client.getTokenInfo(tokens.access_token);
        googleEmail = info.email;
      } catch (e) {
        // Cosmetic only — don't fail the connection over a missing display email.
        console.warn("[calendar/callback] could not read token info:", e);
      }
    }

    // Preserve the previously selected calendar across a disconnect/reconnect.
    const existing = await getConnection(user.userId);

    await saveConnection(user.userId, {
      refreshTokenEncrypted: encryptToken(tokens.refresh_token),
      googleEmail,
      calendarId: existing?.calendarId ?? "primary",
    });

    return redirectToCalendar(req, { connected: "1" });
  } catch (e) {
    console.error("[calendar/callback] token exchange failed:", e);
    return redirectToCalendar(req, { error: "exchange_failed" });
  }
}

export const dynamic = "force-dynamic";
