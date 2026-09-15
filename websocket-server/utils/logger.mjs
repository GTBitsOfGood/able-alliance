// Dev-only diagnostics — never enabled in production, never used for chat
// contents or precise locations (those are excluded even in dev logs).
export function debugLog(...args) {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
}
