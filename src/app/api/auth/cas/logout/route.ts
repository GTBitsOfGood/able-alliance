import { NextRequest, NextResponse } from "next/server";
import { authConfig } from "@/auth";
import { casLogoutUrl, readCASConfig } from "@/server/cas/config";

/**
 * GET /api/auth/cas/logout
 *
 * Clears the session cookie and redirects to CAS logout.
 *
 * The local session is cleared even when CAS configuration is missing or
 * invalid: failing to reach CAS must never leave the user logged in here.
 */
export async function GET(request: NextRequest) {
  const result = readCASConfig();

  let target: string;
  if (result.ok) {
    target = casLogoutUrl(result.config);
  } else {
    console.error("[CAS Logout] CAS is misconfigured:", result.reason);
    target = new URL("/login?error=cas_misconfigured", request.url).toString();
  }

  const response = NextResponse.redirect(target);

  const { name, options } = authConfig.cookies.sessionToken;
  response.cookies.set(name, "", {
    ...options,
    maxAge: 0,
  });

  return response;
}
