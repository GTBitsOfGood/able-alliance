import { NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromRequest } from "@/utils/authUser";
import { buildConsentUrl } from "@/server/google/oauthClient";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";
import { OAUTH_STATE_COOKIE } from "@/server/google/oauthState";

/**
 * Kick off the OAuth flow: mint a CSRF nonce, stash it in an httpOnly cookie,
 * and bounce the browser to Google's consent screen.
 *
 * SameSite=Lax is required (not Strict): the cookie has to survive Google's
 * top-level redirect back to /api/calendar/google/callback.
 */
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
    const state = crypto.randomBytes(32).toString("base64url");
    const response = NextResponse.redirect(buildConsentUrl(state));

    response.cookies.set(OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });

    return response;
  } catch (e) {
    console.error("[calendar/connect] failed to build consent URL:", e);
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}

// Unused elsewhere, but keeps the route from being statically analyzed/cached.
export const dynamic = "force-dynamic";
