import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Paths that don't require authentication
const PUBLIC_PATHS = ["/login", "/api/auth"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

function getCorsOrigin(): string | null {
  const casBase = process.env.CAS_BASE_URL_BROWSER;
  if (!casBase) return null;
  try {
    return new URL(casBase).origin;
  } catch {
    return null;
  }
}

export default auth((request) => {
  const { pathname } = request.nextUrl;

  // CORS: allow the CAS server origin to request our app (e.g. login page RSC fetches after redirect)
  const requestOrigin = request.headers.get("origin");
  const allowedOrigin = getCorsOrigin();
  const addCors = (response: NextResponse) => {
    if (requestOrigin && allowedOrigin && requestOrigin === allowedOrigin) {
      response.headers.set("Access-Control-Allow-Origin", requestOrigin);
      response.headers.set("Vary", "Origin");
    }
    return response;
  };

  if (request.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (requestOrigin && allowedOrigin && requestOrigin === allowedOrigin) {
      res.headers.set("Access-Control-Allow-Origin", requestOrigin);
      res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Access-Control-Max-Age", "86400");
    }
    return res;
  }

  // Allow public paths and static assets
  if (
    isPublicPath(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return addCors(NextResponse.next());
  }

  // Check for valid session — req.auth is populated by Auth.js
  if (!request.auth) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return addCors(NextResponse.next());
});

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
