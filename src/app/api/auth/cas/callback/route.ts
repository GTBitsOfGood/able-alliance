import { NextRequest, NextResponse } from "next/server";
import { encode } from "next-auth/jwt";
import { XMLParser } from "fast-xml-parser";
import { getOrCreateUserFromCAS } from "@/server/db/actions/UserAction";
import { UserNotFoundException } from "@/utils/exceptions/user";

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

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
});

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? extractText(value[0]) : "";
  }

  if (value && typeof value === "object" && "#text" in value) {
    const textValue = (value as { "#text"?: unknown })["#text"];
    return typeof textValue === "string" ? textValue : "";
  }

  return "";
}

function parseCASResponse(xml: string): CASValidationResult {
  const parsed = xmlParser.parse(xml) as {
    serviceResponse?: {
      authenticationFailure?: unknown;
      authenticationSuccess?: {
        user?: unknown;
        attributes?: {
          email?: unknown;
          displayName?: unknown;
          gtid?: unknown;
        };
      };
    };
  };

  const serviceResponse = parsed.serviceResponse;
  if (!serviceResponse) {
    return { success: false, error: "Unexpected CAS response format" };
  }

  if (serviceResponse.authenticationFailure) {
    return {
      success: false,
      error:
        extractText(serviceResponse.authenticationFailure) ||
        "CAS authentication failed",
    };
  }

  const authSuccess = serviceResponse.authenticationSuccess;
  if (!authSuccess) {
    return { success: false, error: "Unexpected CAS response format" };
  }

  const username = extractText(authSuccess.user);
  const email = extractText(authSuccess.attributes?.email);
  const displayName = extractText(authSuccess.attributes?.displayName);
  const gtid = extractText(authSuccess.attributes?.gtid);

  if (!username) {
    return { success: false, error: "No user found in CAS response" };
  }

  return {
    success: true,
    username,
    attributes: {
      email,
      displayName,
      gtid,
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
  const buildValidateUrl = (baseUrl: string) =>
    `${baseUrl}/p3/serviceValidate?ticket=${encodeURIComponent(ticket)}&service=${encodeURIComponent(serviceUrl)}`;

  const validateUrl = buildValidateUrl(casBaseUrl);

  const fetchCASValidation = async () => {
    try {
      return await fetch(validateUrl);
    } catch (error) {
      // In local dev, users often copy Docker env values (cas:8443) into .env.
      // Retry against localhost once so local and Docker workflows both work.
      const shouldRetryLocalhost =
        casBaseUrl.includes("cas:8443") && !casBaseUrl.includes("localhost");

      if (!shouldRetryLocalhost) {
        throw error;
      }

      const fallbackBaseUrl = casBaseUrl.replace("cas:8443", "localhost:8443");
      const fallbackValidateUrl = buildValidateUrl(fallbackBaseUrl);
      console.warn(
        "[CAS Callback] CAS host unreachable, retrying with localhost:",
        fallbackValidateUrl,
      );

      return fetch(fallbackValidateUrl);
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
      return NextResponse.redirect(`${loginUrl}?error=cas_unavailable`);
    }

    const xmlBody = await casResponse.text();
    const result = parseCASResponse(xmlBody);

    if (!result.success || !result.attributes) {
      console.error("[CAS Callback] CAS validation failed:", result.error);
      return NextResponse.redirect(`${loginUrl}?error=invalid_ticket`);
    }
    const attributes = result.attributes;

    // Look up the user in our database (do not auto-provision from CAS).
    console.log(`[CAS Callback] Looking up user: ${attributes.email}`);
    const user = await (async () => {
      try {
        return await getOrCreateUserFromCAS({
          email: attributes.email,
          name: attributes.displayName,
          gtid: attributes.gtid,
        });
      } catch (error) {
        if (error instanceof UserNotFoundException) {
          console.error("[CAS Callback] CAS user not provisioned in app DB");
          return NextResponse.redirect(`${loginUrl}?error=user_not_found`);
        }
        throw error;
      }
    })();

    if (user instanceof NextResponse) {
      return user;
    }
    console.log(
      `[CAS Callback] User ${user._id} retrieved (type: ${user.type})`,
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
        email: attributes.email,
        gtid: attributes.gtid || "",
        name: attributes.displayName,
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
