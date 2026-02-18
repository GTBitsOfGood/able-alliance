import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { getOrCreateUserFromCAS } from "@/server/db/actions/UserAction";

interface CASAttributes {
  email: string;
  displayName: string;
  gtid: string;
}

interface CASValidationResult {
  success: boolean;
  username?: string;
  attributes?: CASAttributes;
  error?: string;
}

/**
 * Parse CAS 3.0 XML response to extract user info.
 * CAS 3.0 returns XML, not JSON. We parse it with simple regex
 * since we control the mock server's output format.
 */
function parseCASResponse(xml: string): CASValidationResult {
  // Check for authentication failure
  const failureMatch = xml.match(
    /<cas:authenticationFailure[^>]*>([\s\S]*?)<\/cas:authenticationFailure>/,
  );
  if (failureMatch) {
    return { success: false, error: failureMatch[1].trim() };
  }

  // Check for authentication success
  const successMatch = xml.match(/<cas:authenticationSuccess>/);
  if (!successMatch) {
    return { success: false, error: "Unexpected CAS response format" };
  }

  const userMatch = xml.match(/<cas:user>(.*?)<\/cas:user>/);
  const emailMatch = xml.match(/<cas:email>(.*?)<\/cas:email>/);
  const displayNameMatch = xml.match(
    /<cas:displayName>(.*?)<\/cas:displayName>/,
  );
  const gtidMatch = xml.match(/<cas:gtid>(.*?)<\/cas:gtid>/);

  if (!userMatch) {
    return { success: false, error: "No user found in CAS response" };
  }

  return {
    success: true,
    username: userMatch[1],
    attributes: {
      email: emailMatch?.[1] || "",
      displayName: displayNameMatch?.[1] || "",
      gtid: gtidMatch?.[1] || "",
    },
  };
}

/**
 * GET /api/auth/cas/callback?ticket=ST-xxx
 *
 * CAS redirects here after successful login.
 * This handler validates the ticket server-to-server, then creates a session.
 */
export async function GET(request: NextRequest) {
  const ticket = request.nextUrl.searchParams.get("ticket");
  const appUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const loginUrl = `${appUrl}/login`;

  if (!ticket) {
    return NextResponse.redirect(`${loginUrl}?error=no_ticket`);
  }

  // The service URL must match what was originally sent to CAS
  const serviceUrl = `${appUrl}/api/auth/cas/callback`;
  // Use the internal Docker URL for server-to-server validation
  const casBaseUrl = process.env.CAS_BASE_URL || "http://localhost:8443/cas";
  const validateUrl = `${casBaseUrl}/p3/serviceValidate?ticket=${encodeURIComponent(ticket)}&service=${encodeURIComponent(serviceUrl)}`;

  try {
    // Server-to-server: validate the ticket with the CAS server
    const casResponse = await fetch(validateUrl);
    if (!casResponse.ok) {
      console.error(
        "[CAS Callback] CAS validation request failed:",
        casResponse.status,
      );
      return NextResponse.redirect(`${loginUrl}?error=cas_unavailable`);
    }

    const xmlBody = await casResponse.text();
    const result = parseCASResponse(xmlBody);

    if (!result.success || !result.attributes) {
      console.error("[CAS Callback] CAS validation failed:", result.error);
      return NextResponse.redirect(`${loginUrl}?error=invalid_ticket`);
    }

    // Look up or create the user in our database
    console.log(`[CAS Callback] Looking up user: ${result.attributes.email}`);
    const user = await getOrCreateUserFromCAS({
      email: result.attributes.email,
      name: result.attributes.displayName,
      gtid: result.attributes.gtid,
    });
    console.log(
      `[CAS Callback] User ${user._id} retrieved/created (type: ${user.type})`,
    );

    const userId = (user._id as object).toString();
    const userType = user.type;

    // Encode a JWT with the user's info
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      throw new Error("NEXTAUTH_SECRET is not set");
    }

    const token = await encode({
      token: {
        sub: userId,
        userId,
        type: userType,
        email: result.attributes.email,
        gtid: result.attributes.gtid || "",
        name: result.attributes.displayName,
      },
      secret,
      salt: "authjs.session-token",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    // Set the session cookie and redirect to home
    const response = NextResponse.redirect(appUrl);
    response.cookies.set("authjs.session-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("[CAS Callback] Error during CAS validation:", error);
    return NextResponse.redirect(`${loginUrl}?error=server_error`);
  }
}
