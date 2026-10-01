import { NextRequest, NextResponse } from "next/server";
import {
  casLoginUrl,
  loginErrorRedirect,
  readCASConfig,
} from "@/server/cas/config";

/**
 * GET /api/auth/cas/login
 *
 * Redirects the browser to the CAS login page.
 * The CAS server will redirect back to /api/auth/cas/callback with a ticket.
 */
export async function GET(request: NextRequest) {
  const result = readCASConfig();
  if (!result.ok) {
    console.error("[CAS Login] CAS is misconfigured:", result.reason);
    return loginErrorRedirect(request, "cas_misconfigured");
  }

  return NextResponse.redirect(casLoginUrl(result.config));
}
