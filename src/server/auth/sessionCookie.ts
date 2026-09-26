/**
 * The Auth.js session cookie name.
 *
 * Auth.js prefixes the cookie with `__Secure-` over HTTPS, and the name is
 * also used as the JWT encryption salt — so minting (the CAS callback) and
 * clearing (the CAS logout route) must agree on it exactly.
 */
export function sessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

/** Whether the session cookie should carry the Secure attribute. */
export function secureCookiesEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}
