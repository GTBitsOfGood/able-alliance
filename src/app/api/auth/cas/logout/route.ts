import { NextResponse } from "next/server";

/**
 * GET /api/auth/cas/logout
 *
 * Clears the session cookie and redirects to CAS logout.
 */
export async function GET() {
  const casBaseUrl =
    process.env.CAS_BASE_URL_BROWSER || "http://localhost:8443/cas";
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

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
