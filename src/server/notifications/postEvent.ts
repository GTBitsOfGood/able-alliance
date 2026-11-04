/**
 * Best-effort POST of a real-time event to the websocket server's internal
 * /events endpoint. Never throws and is not meant to be awaited — a failure
 * here must not interfere with the caller's flow.
 */
export function postEvent(body: Record<string, unknown>): void {
  const url = process.env.WEBSOCKET_INTERNAL_URL;
  const secret = process.env.WEBSOCKET_INTERNAL_SECRET;
  if (!url || !secret) {
    console.error(
      `postEvent(${body.event}): WEBSOCKET_INTERNAL_URL/SECRET not configured`,
    );
    return;
  }

  void send(url, secret, body);
}

async function send(
  url: string,
  secret: string,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    const res = await fetch(`${url}/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(
        `postEvent(${body.event}): events failed with status ${res.status}`,
      );
    }
  } catch (error) {
    console.error(
      `postEvent(${body.event}): failed to reach websocket server`,
      error,
    );
  }
}
