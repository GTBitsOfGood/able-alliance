import { NextResponse } from "next/server";

/**
 * CAS configuration, read and validated from the environment.
 *
 * Three variables rather than one because the mock CAS server runs inside
 * Docker: the browser reaches it at localhost:8443 while the app container
 * reaches it at cas:8443. Against real GT CAS (https://sso.gatech.edu/cas)
 * both collapse to the same public host.
 */
export interface CASConfig {
  /** Base URL the browser is redirected to, for /login and /logout. */
  browserBaseUrl: string;
  /** Base URL used for server-to-server ticket validation. */
  serverBaseUrl: string;
  /** This app's own origin. The CAS `service` parameter is built from it. */
  appUrl: string;
}

export type CASConfigResult =
  | { ok: true; config: CASConfig }
  | { ok: false; reason: string };

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, "");

/**
 * Parse one environment variable as an absolute http(s) URL, collecting a
 * human-readable problem instead of throwing so the caller can report every
 * misconfigured variable at once.
 */
function readAbsoluteUrl(
  name: string,
  raw: string | undefined,
  problems: string[],
): string | null {
  if (!raw || raw.trim() === "") {
    problems.push(`${name} is not set`);
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    problems.push(`${name} is not a valid absolute URL`);
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    problems.push(`${name} must use http:// or https://`);
    return null;
  }

  return stripTrailingSlash(parsed.toString());
}

/**
 * Read CAS configuration. Never throws: callers redirect to the login page
 * with an error rather than surfacing a 500, so a deployment with missing or
 * malformed CAS variables degrades to a readable message.
 */
export function readCASConfig(): CASConfigResult {
  const problems: string[] = [];

  const browserBaseUrl = readAbsoluteUrl(
    "CAS_BASE_URL_BROWSER",
    process.env.CAS_BASE_URL_BROWSER,
    problems,
  );
  const serverBaseUrl = readAbsoluteUrl(
    "CAS_BASE_URL",
    process.env.CAS_BASE_URL,
    problems,
  );
  const appUrl = readAbsoluteUrl(
    "DEPLOY_PRIME_URL",
    process.env.DEPLOY_PRIME_URL,
    problems,
  );

  if (!browserBaseUrl || !serverBaseUrl || !appUrl) {
    return { ok: false, reason: problems.join("; ") };
  }

  return { ok: true, config: { browserBaseUrl, serverBaseUrl, appUrl } };
}

/**
 * The CAS `service` parameter. CAS compares this string byte-for-byte between
 * /login and /serviceValidate, so both must be built here.
 */
export const casServiceUrl = (config: CASConfig) =>
  `${config.appUrl}/api/auth/cas/callback`;

export const casLoginUrl = (config: CASConfig) =>
  `${config.browserBaseUrl}/login?service=${encodeURIComponent(casServiceUrl(config))}`;

export const casLogoutUrl = (config: CASConfig) =>
  `${config.browserBaseUrl}/logout?service=${encodeURIComponent(`${config.appUrl}/login`)}`;

/** CAS 3.0 validation endpoint, matching the `cas_version: "3.0"` GT documents. */
export const casValidateUrl = (
  baseUrl: string,
  ticket: string,
  serviceUrl: string,
) =>
  `${baseUrl}/p3/serviceValidate?ticket=${encodeURIComponent(ticket)}&service=${encodeURIComponent(serviceUrl)}`;

/**
 * Redirect to the login page with an error code the page can explain.
 *
 * `appUrl` is used when it is available so the redirect keeps the public
 * origin behind a proxy; when CAS config itself is what failed, the incoming
 * request URL is the only origin we can trust.
 */
export function loginErrorRedirect(
  request: Request,
  code: string,
  appUrl?: string,
): NextResponse {
  const target = appUrl
    ? `${appUrl}/login?error=${code}`
    : new URL(`/login?error=${code}`, request.url).toString();
  return NextResponse.redirect(target);
}
