import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { authConfig } from "@/auth";

// Paths that don't require authentication
const PUBLIC_PATHS = ["/login", "/api/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    isPublicPath(pathname) ||
    pathname === "/api/email/chat" || // this route has its own authentication b/c its called from websocket server
    pathname.startsWith("/api/internal/") || // called from the websocket server; gated on a shared secret, not a session
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Read the cookie without renewing it. auth() middleware writes a refreshed
  // cookie on every response, so an older request can undo a role switch.
  // Database-backed authorization remains in server pages and API handlers.
  const token = await getToken({
    req: request,
    secret: authConfig.secret,
    cookieName: authConfig.cookies.sessionToken.name,
    secureCookie: authConfig.useSecureCookies,
  });
  if (!token?.userId) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files, Next.js internals, and Auth.js
  // endpoints (so Auth.js doesn't add a session cookie to the response).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth/).*)"],
};
