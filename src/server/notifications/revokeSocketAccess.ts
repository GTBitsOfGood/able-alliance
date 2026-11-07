/**
 * Tells the websocket server to re-check open sockets for a user or a ride
 * and drop any whose access no longer holds.
 *
 * Call this wherever permissions change — a driver reassigned off a ride, an
 * account archived, a role removed. The socket server re-verifies each
 * candidate, so passing a user who is still allowed is harmless.
 *
 * Best-effort and not meant to be awaited: the socket server also re-checks
 * every connection on a timer, so a failure here delays revocation rather
 * than losing it.
 */
export function revokeSocketAccess(filter: {
  userId?: string;
  routeId?: string;
}): void {
  if (!filter.userId && !filter.routeId) return;

  const url = process.env.WEBSOCKET_INTERNAL_URL;
  const secret = process.env.WEBSOCKET_INTERNAL_SECRET;
  if (!url || !secret) {
    console.error(
      "revokeSocketAccess: WEBSOCKET_INTERNAL_URL/SECRET not configured",
    );
    return;
  }

  void send(url, secret, filter);
}

async function send(
  url: string,
  secret: string,
  filter: { userId?: string; routeId?: string },
): Promise<void> {
  try {
    const res = await fetch(`${url}/revoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify(filter),
    });
    if (!res.ok) {
      console.error(`revokeSocketAccess: failed with status ${res.status}`);
    }
  } catch (error) {
    console.error(
      "revokeSocketAccess: failed to reach websocket server",
      error,
    );
  }
}
