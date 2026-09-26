import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { encode } from "next-auth/jwt";
import { getProvisionedUserFromCAS } from "@/server/db/actions/UserAction";
import { UserNotFoundException } from "@/utils/exceptions/user";
import {
  secureCookiesEnabled,
  sessionCookieName,
} from "@/server/auth/sessionCookie";
import {
  casServiceUrl,
  casValidateUrl,
  loginErrorRedirect,
  readCASConfig,
} from "@/server/cas/config";
import { parseCASResponse } from "@/server/cas/parseResponse";

/**
 * GET /api/auth/cas/callback?ticket=ST-xxx
 *
 * CAS redirects here after successful login.
 * This handler validates the ticket server-to-server, then creates a session.
 */
export async function GET(request: NextRequest) {
  const configResult = readCASConfig();
  if (!configResult.ok) {
    console.error("[CAS Callback] CAS is misconfigured:", configResult.reason);
    return loginErrorRedirect(request, "cas_misconfigured");
  }
  const { appUrl, serverBaseUrl } = configResult.config;

  const ticket = request.nextUrl.searchParams.get("ticket");
  if (!ticket) {
    return loginErrorRedirect(request, "no_ticket", appUrl);
  }

  // The service URL must match what was originally sent to CAS, byte for byte.
  const serviceUrl = casServiceUrl(configResult.config);
  const validateUrl = casValidateUrl(serverBaseUrl, ticket, serviceUrl);

  const fetchCASValidation = async () => {
    try {
      return await fetch(validateUrl);
    } catch (error) {
      // In local dev, users often copy Docker env values (cas:8443) into .env.
      // Retry against localhost once so local and Docker workflows both work.
      const shouldRetryLocalhost =
        serverBaseUrl.includes("cas:8443") &&
        !serverBaseUrl.includes("localhost");

      if (!shouldRetryLocalhost) {
        throw error;
      }

      const fallbackBaseUrl = serverBaseUrl.replace(
        "cas:8443",
        "localhost:8443",
      );
      console.warn(
        "[CAS Callback] CAS host unreachable, retrying with localhost",
      );

      return fetch(casValidateUrl(fallbackBaseUrl, ticket, serviceUrl));
    }
  };

  try {
    // Server-to-server: validate the ticket with the CAS server
    const casResponse = await fetchCASValidation();
    if (!casResponse.ok) {
      console.error(
        "[CAS Callback] CAS validation request failed:",
        casResponse.status,
      );
      return loginErrorRedirect(request, "cas_unavailable", appUrl);
    }

    const xmlBody = await casResponse.text();
    const result = parseCASResponse(xmlBody);

    if (!result.success) {
      console.error("[CAS Callback] CAS validation failed:", result.error);
      return loginErrorRedirect(request, "invalid_ticket", appUrl);
    }

    const { username, attributes } = result;

    // Look up the user by GT username (do not auto-provision from CAS).
    let user;
    try {
      user = await getProvisionedUserFromCAS(username);
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        console.error(
          `[CAS Callback] CAS user "${username}" is not provisioned in the app database`,
        );
        return loginErrorRedirect(request, "user_not_found", appUrl);
      }
      throw error;
    }

    const userId = (user._id as object).toString();

    // The database record is authoritative for profile data. CAS attributes are
    // optional, so displayName only fills in when the app has nothing better.
    const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
    const displayName = attributes.displayName ?? (fullName || username);

    // Encode a JWT with the user's info
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error("[CAS Callback] NEXTAUTH_SECRET is not set");
      return loginErrorRedirect(request, "server_error", appUrl);
    }

    // Auth.js uses __Secure-authjs.session-token in production (HTTPS); salt must match cookie name
    const cookieName = sessionCookieName();

    const token = await encode({
      token: {
        sub: userId,
        userId,
        type: user.type,
        gtUsername: username,
        email: user.email,
        name: displayName,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      secret,
      salt: cookieName,
      maxAge: 24 * 60 * 60, // 24 hours
    });

    // Redirect to same origin so cookie domain matches; set cookie via next/headers for better compatibility with Netlify
    const cookieStore = await cookies();
    cookieStore.set(cookieName, token, {
      httpOnly: true,
      secure: secureCookiesEnabled(),
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });
    return NextResponse.redirect(appUrl, 302);
  } catch (error) {
    console.error("[CAS Callback] Error during CAS validation:", error);
    return loginErrorRedirect(request, "server_error", appUrl);
  }
}
