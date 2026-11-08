import { RouteStatus } from "@db/generated/enums";
import { withDelay } from "./dateEst";

type UpcomingRide = {
  status: RouteStatus;
  scheduledPickupTime: string | Date;
  delayMinutes?: number | null;
};

/** Shared student/driver selection, independent of the week being browsed. */
export function getNextRide<T extends UpcomingRide>(
  routes: readonly T[],
  now = Date.now(),
): T | undefined {
  const pickupTime = (route: T) =>
    withDelay(
      new Date(route.scheduledPickupTime),
      route.delayMinutes ?? 0,
    ).getTime();

  return routes
    .filter((route) => {
      if (
        route.status === RouteStatus.Completed ||
        route.status === RouteStatus.Missing ||
        route.status === RouteStatus.CancelledByAdmin ||
        route.status === RouteStatus.CancelledByStudent
      )
        return false;
      return (
        route.status === RouteStatus.EnRoute ||
        route.status === RouteStatus.Arrived ||
        route.status === RouteStatus.Pickedup ||
        pickupTime(route) >= now
      );
    })
    .toSorted((a, b) => pickupTime(a) - pickupTime(b))[0];
}
