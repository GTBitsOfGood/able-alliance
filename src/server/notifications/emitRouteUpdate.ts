import { postEvent } from "./postEvent";

type RouteRef = {
  id: { toString(): string };
  status: string;
  student?: { id?: { toString(): string } } | null;
  driver?: { id?: { toString(): string } } | null;
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
  const userIds = [
    ...new Set(
      [
        route.student?.id?.toString(),
        route.driver?.id?.toString(),
        ...extraUserIds,
      ].filter((id): id is string => !!id),
    ),
  ];
  const routeId = route.id.toString();

  postEvent({
    event: "routeUpdated",
    userIds,
    toAdmins: true,
    payload: { routeId, status: route.status },
  });
}
