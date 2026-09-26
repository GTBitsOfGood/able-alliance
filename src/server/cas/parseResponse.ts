import { XMLParser } from "fast-xml-parser";

/**
 * Attributes CAS may release alongside the username.
 *
 * Both are optional. GT's own CAS example (the Express `express-cas-authentication`
 * starter) opts into attributes via `session_info` and then never reads them —
 * it identifies users purely by `cas:user`. Attribute release is configured per
 * registered service, so nothing may depend on a given attribute being present.
 */
export interface CASAttributes {
  email?: string;
  displayName?: string;
}

export type CASValidationResult =
  | {
      success: true;
      /** The GT Account username from `cas:user`. The only guaranteed identity. */
      username: string;
      attributes: CASAttributes;
    }
  | { success: false; error: string };

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  trimValues: true,
});

function extractText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? extractText(value[0]) : "";
  }

  if (value && typeof value === "object" && "#text" in value) {
    return extractText((value as { "#text"?: unknown })["#text"]);
  }

  return "";
}

/** Absent, empty, and whitespace-only attributes all mean "not released". */
function extractOptionalText(value: unknown): string | undefined {
  const text = extractText(value).trim();
  return text === "" ? undefined : text;
}

/**
 * Parse a CAS 3.0 /p3/serviceValidate response.
 *
 * The `<cas:attributes>` block may be missing entirely, may hold only some of
 * the attributes, or may hold empty elements — all of which are valid and must
 * yield a successful login as long as `<cas:user>` is present.
 */
export function parseCASResponse(xml: string): CASValidationResult {
  let parsed: {
    serviceResponse?: {
      authenticationFailure?: unknown;
      authenticationSuccess?: {
        user?: unknown;
        attributes?: {
          email?: unknown;
          displayName?: unknown;
        };
      };
    };
  };

  try {
    parsed = xmlParser.parse(xml);
  } catch {
    return { success: false, error: "CAS response was not valid XML" };
  }

  const serviceResponse = parsed?.serviceResponse;
  if (!serviceResponse) {
    return { success: false, error: "Unexpected CAS response format" };
  }

  if (serviceResponse.authenticationFailure) {
    return {
      success: false,
      error:
        extractOptionalText(serviceResponse.authenticationFailure) ??
        "CAS authentication failed",
    };
  }

  const authSuccess = serviceResponse.authenticationSuccess;
  if (!authSuccess) {
    return { success: false, error: "Unexpected CAS response format" };
  }

  const username = extractOptionalText(authSuccess.user);
  if (!username) {
    return { success: false, error: "No user found in CAS response" };
  }

  return {
    success: true,
    username,
    attributes: {
      email: extractOptionalText(authSuccess.attributes?.email),
      displayName: extractOptionalText(authSuccess.attributes?.displayName),
    },
  };
}
