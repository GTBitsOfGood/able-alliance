import { NextResponse } from "next/server";

/**
 * GET /api/auth/cas/login
 *
 * Redirects the browser to the CAS login page.
 * The CAS server will redirect back to /api/auth/cas/callback with a ticket.
 */
export async function GET() {
  try {
    const casBaseUrl = process.env.CAS_BASE_URL_BROWSER;
    if (!casBaseUrl) {
      throw new Error("CAS_BASE_URL_BROWSER environment variable is required");
    }
    const appUrl = process.env.DEPLOY_PRIME_URL;
    if (!appUrl) {
      throw new Error("DEPLOY_PRIME_URL environment variable is required");
    }
    const serviceUrl = `${appUrl}/api/auth/cas/callback`;

    const casLoginUrl = `${casBaseUrl}/login?service=${encodeURIComponent(serviceUrl)}`;

    return NextResponse.redirect(casLoginUrl);
  } catch (error) {
    console.error("[CAS Login]", error);
    return NextResponse.json(
      { error: "Server configuration error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
