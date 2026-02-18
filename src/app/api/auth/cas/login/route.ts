import { NextResponse } from "next/server";

/**
 * GET /api/auth/cas/login
 *
 * Redirects the browser to the CAS login page.
 * The CAS server will redirect back to /api/auth/cas/callback with a ticket.
 */
export async function GET() {
  const casBaseUrl =
    process.env.CAS_BASE_URL_BROWSER || "http://localhost:8443/cas";
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const serviceUrl = `${appUrl}/api/auth/cas/callback`;

  const casLoginUrl = `${casBaseUrl}/login?service=${encodeURIComponent(serviceUrl)}`;

  return NextResponse.redirect(casLoginUrl);
}
