/**
 Allows us to more easily debug errors in development, while hiding details in production.
 */
export function internalErrorPayload(e: unknown): { error: string } {
  if (process.env.NODE_ENV === "production") {
    return { error: "Internal server error" };
  }
  const message = e instanceof Error ? e.message : "Internal server error";
  return { error: message };
}
