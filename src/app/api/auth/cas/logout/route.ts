import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/cas/logout
 *
 * Clears the session cookie and redirects to CAS logout.
 */
export async function GET(request: NextRequest) {
  const casBaseUrl = process.env.CAS_BASE_URL_BROWSER;
  if (!casBaseUrl) {
    throw new Error("CAS_BASE_URL_BROWSER environment variable is required");
  }
  const appUrl = process.env.DEPLOY_PRIME_URL ?? request.nextUrl.origin;

  const casLogoutUrl = `${casBaseUrl}/logout?service=${encodeURIComponent(`${appUrl}/login`)}`;

  const response = NextResponse.redirect(casLogoutUrl);

  // Clear the session cookie (same name Auth.js uses: __Secure- prefix in production)
  const useSecureCookies = process.env.NODE_ENV === "production";
  const sessionCookieName = useSecureCookies
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  response.cookies.set(sessionCookieName, "", {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
