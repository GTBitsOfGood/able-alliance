type RouteRef = {
  _id: { toString(): string };
  status: string;
  student?: { _id?: { toString(): string } } | null;
  driver?: { _id?: { toString(): string } } | null;
};

/**
 * Best-effort push of a "route changed" event via the websocket server so
 * open clients can refetch. Sent to the route's student and driver (plus any
 * extra users, e.g. a previous driver) and to all admins. Unlike toasts, this
 * is not gated on notification preferences. Never throws and is not meant to
 * be awaited — a failure here must not interfere with the caller's flow.
 */
export function emitRouteUpdate(
  route: RouteRef,
  extraUserIds: string[] = [],
): void {
  const url = process.env.WEBSOCKET_INTERNAL_URL;
  const secret = process.env.WEBSOCKET_INTERNAL_SECRET;
  if (!url || !secret) {
    console.error(
      "emitRouteUpdate: WEBSOCKET_INTERNAL_URL/SECRET not configured",
    );
    return;
  }

  const userIds = [
    ...new Set(
      [
        route.student?._id?.toString(),
        route.driver?._id?.toString(),
        ...extraUserIds,
      ].filter((id): id is string => !!id),
    ),
  ];
  const routeId = route._id.toString();

  void postRouteUpdate(url, secret, {
    event: "routeUpdated",
    userIds,
    toAdmins: true,
    payload: { routeId, status: route.status },
  });
}

async function postRouteUpdate(
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
      console.error(`emitRouteUpdate: events failed with status ${res.status}`);
    }
  } catch (error) {
    console.error("emitRouteUpdate: failed to reach websocket server", error);
  }
}
