import { NextResponse } from "next/server";

/**
 * GET /api/auth/cas/logout
 *
 * Clears the session cookie and redirects to CAS logout.
 */
export async function GET() {
  const casBaseUrl = process.env.CAS_BASE_URL_BROWSER;
  if (!casBaseUrl) {
    throw new Error("CAS_BASE_URL_BROWSER environment variable is required");
  }
  const appUrl = process.env.DEPLOY_PRIME_URL;
  if (!appUrl) {
    throw new Error("DEPLOY_PRIME_URL environment variable is required");
  }

  const casLogoutUrl = `${casBaseUrl}/logout?service=${encodeURIComponent(`${appUrl}/login`)}`;

  const response = NextResponse.redirect(casLogoutUrl);

  // Clear the session cookie
  response.cookies.set("authjs.session-token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
