import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/cas/login
 *
 * Redirects the browser to the CAS login page.
 * The CAS server will redirect back to /api/auth/cas/callback with a ticket.
 */
export async function GET(request: NextRequest) {
  const casBaseUrl = process.env.CAS_BASE_URL_BROWSER;
  if (!casBaseUrl) {
    throw new Error("CAS_BASE_URL_BROWSER environment variable is required");
  }
  // Use DEPLOY_PRIME_URL when set (e.g. Docker); otherwise derive from request (Netlify doesn't inject it at runtime).
  const appUrl = process.env.DEPLOY_PRIME_URL ?? request.nextUrl.origin;
  const serviceUrl = `${appUrl}/api/auth/cas/callback`;

  const casLoginUrl = `${casBaseUrl}/login?service=${encodeURIComponent(serviceUrl)}`;

  return NextResponse.redirect(casLoginUrl);
}
