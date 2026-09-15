/** Every knob the harness reads from the environment, with defaults that need no setup. */
const env = (key: string, fallback: string) => process.env[key] ?? fallback;

export const E2E = {
  /** Port 3100 on purpose: never collides with `npm run dev` or docker compose on 3000. */
  baseURL: env("E2E_BASE_URL", "http://localhost:3100"),
  /** Dedicated database.
   * The seed refuses to wipe a name without "e2e"/"test" unless E2E_ALLOW_ANY_DB=1. */
  mongodbUri: env(
    "E2E_MONGODB_URI",
    "mongodb://localhost:27017/able-alliance-e2e",
  ),
  /** Must match the app under test — session cookies are minted with it. */
  nextAuthSecret: env("E2E_NEXTAUTH_SECRET", "dev-secret-change-in-production"),
  /** Auth.js picks the cookie name from the URL scheme: plain name over http, "__Secure-" prefix over https. */
  sessionCookieName: env("E2E_SESSION_COOKIE", "authjs.session-token"),
  /** 1 = the app is already running at baseURL; don't launch one. */
  externalServer: process.env.E2E_EXTERNAL_SERVER === "1",
};

/** Environment for the app process Playwright launches (`next build && next start`). */
export function appServerEnv(): Record<string, string> {
  const inherited: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) inherited[k] = v;
  }
  return {
    ...inherited,
    PORT: new URL(E2E.baseURL).port || "3000",
    MONGODB_URI: E2E.mongodbUri,
    NEXTAUTH_SECRET: E2E.nextAuthSecret,
    DEPLOY_PRIME_URL: E2E.baseURL,
    // Production Auth.js rejects unknown hosts (dev trusts all); localhost must be trusted.
    AUTH_TRUST_HOST: "true",
    // CAS is never hit (sessions are minted), but the login route reads these lazily.
    CAS_BASE_URL: "http://localhost:8443/cas",
    CAS_BASE_URL_BROWSER: "http://localhost:8443/cas",
    SUPERADMIN_EMAIL: "superadmin@gatech.edu",
    SUPERADMIN_FIRSTNAME: "Super",
    SUPERADMIN_LASTNAME: "Admin",
    // Empty tokens make src/server/mapbox.ts and the map components no-op: no outbound calls.
    MAPBOX_TOKEN: "",
    NEXT_PUBLIC_MAPBOX_TOKEN: "",
  };
}
