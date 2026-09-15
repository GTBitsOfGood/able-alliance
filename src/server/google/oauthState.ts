/**
 * Name of the httpOnly cookie holding the OAuth CSRF nonce.
 *
 * Lives here rather than in the connect route because Next.js route modules may
 * only export request handlers and a fixed set of config keys — any other export
 * fails type generation.
 */
export const OAUTH_STATE_COOKIE = "google_oauth_state";
