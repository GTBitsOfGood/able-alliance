import { RouteStatus } from "@db/generated/enums";

// Prisma enum identifiers cannot contain spaces or hyphens. Keep API labels stable.
export const routeStatusLabels = {
  Requested: "Requested",
  Scheduled: "Scheduled",
  EnRoute: "En-route",
  Pickedup: "Pickedup",
  Completed: "Completed",
  Missing: "Missing",
  CancelledByStudent: "Cancelled by Student",
  CancelledByAdmin: "Cancelled by Admin",
} as const satisfies Record<RouteStatus, string>;

// "Delayed" is a display label, not a RouteStatus: the status keeps tracking
// where the ride is (Scheduled / EnRoute) so transitions are unaffected.
const DELAYABLE_STATUSES: ReadonlySet<RouteStatus> = new Set([
  RouteStatus.Scheduled,
  RouteStatus.EnRoute,
]);

type StatusRoute = { status: RouteStatus; delayMinutes?: number | null };

/** A ride shows as delayed only before pickup; afterwards the real status shows. */
export function isRouteDelayed(route: StatusRoute): boolean {
  return (route.delayMinutes ?? 0) > 0 && DELAYABLE_STATUSES.has(route.status);
}

export function routeDisplayLabel(route: StatusRoute): string {
  return isRouteDelayed(route) ? "Delayed" : routeStatusLabels[route.status];
}
