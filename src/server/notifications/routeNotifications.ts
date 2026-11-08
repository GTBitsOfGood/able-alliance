import type { Prisma } from "@db/generated/client";
import { RouteStatus } from "@db/generated/enums";

import type { adminRouteInclude, userInclude } from "@/server/queries";
import {
  getRideEmailDetails,
  sendRideCancelled,
  sendDriverEnRoute,
  sendRideAssigned,
  sendRideUpdated,
  sendRideCompleted,
  sendRideConfirmed,
  sendRideDelayed,
} from "@/server/email/email";
import { formatEstDate, formatEstTime } from "@/utils/dateEst";
import { RIDE_NOTIFICATIONS } from "@/utils/consts";

import { emitToast } from "./emitToast";
import type { ToastPayload } from "@/types/notifications";

type NotificationRoute = Prisma.RouteGetPayload<{
  include: typeof adminRouteInclude;
}>;

type NotificationUser = Prisma.UserGetPayload<{ include: typeof userInclude }>;

type Delivery = () => Promise<void>;

// Start each channel independently and report each failure once. Callers can
// await delivery in a background job or track it with after() in a request.
async function deliverNotifications(
  routeId: string,
  deliveries: Delivery[],
): Promise<void> {
  const results = await Promise.allSettled(
    deliveries.map(async (send) => send()),
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        `Notification delivery failed for ride ${routeId}`,
        result.reason,
      );
    }
  }
}

function recipientName(user: NotificationUser): string {
  return user.preferredName ?? `${user.firstName} ${user.lastName}`;
}

export function notifyRideStatusChanged(
  route: NotificationRoute,
  notificationOverride?: ToastPayload,
): Promise<void> {
  const { student, driver, status } = route;
  const notification =
    notificationOverride ?? RIDE_NOTIFICATIONS[status](route.pickup.name);

  const deliveries: Delivery[] = [
    () => emitToast(student.id, "Student", notification),
  ];

  if (status === RouteStatus.EnRoute && student.settings?.driverEnRoute) {
    deliveries.push(() =>
      sendDriverEnRoute(
        student.email,
        recipientName(student),
        getRideEmailDetails(route),
      ),
    );
  }

  if (status === RouteStatus.Completed && student.settings?.rideCompleted) {
    deliveries.push(() =>
      sendRideCompleted(
        student.email,
        recipientName(student),
        getRideEmailDetails(route),
      ),
    );
  }

  if (
    status === RouteStatus.CancelledByStudent ||
    status === RouteStatus.CancelledByAdmin
  ) {
    const details = {
      ...getRideEmailDetails(route),
      reason:
        status === RouteStatus.CancelledByStudent
          ? "Cancelled by the rider."
          : "Cancelled by an administrator.",
    };

    if (student.settings?.rideCancelled) {
      deliveries.push(() =>
        sendRideCancelled(student.email, recipientName(student), details),
      );
    }

    if (driver) {
      deliveries.push(() => emitToast(driver.id, "Driver", notification));

      if (driver.settings?.rideCancelled) {
        deliveries.push(() =>
          sendRideCancelled(driver.email, recipientName(driver), details),
        );
      }
    }
  }

  return deliverNotifications(route.id, deliveries);
}

export function notifyRideDelayed(route: NotificationRoute): Promise<void> {
  const shift = (date: Date) =>
    new Date(date.getTime() + route.delayMinutes * 60_000);

  const deliveries: Delivery[] = [
    // The email sender applies each recipient's rideDelayed preference.
    () =>
      sendRideDelayed(route.id, {
        delay: `${route.delayMinutes} minutes`,
        oldPickupTime: formatEstTime(route.scheduledPickupTime),
        newPickupTime: formatEstTime(shift(route.scheduledPickupTime)),
        oldDropoffTime: route.estimatedDropoffTime
          ? formatEstTime(route.estimatedDropoffTime)
          : "N/A",
        newDropoffTime: route.estimatedDropoffTime
          ? formatEstTime(shift(route.estimatedDropoffTime))
          : "N/A",
      }),

    () =>
      emitToast(
        route.student.id,
        "Student",
        RIDE_NOTIFICATIONS.studentDelayed(route.delayMinutes),
      ),
  ];

  const driver = route.driver;

  if (driver) {
    deliveries.push(() =>
      emitToast(
        driver.id,
        "Driver",
        RIDE_NOTIFICATIONS.driverDelayed(route.delayMinutes),
      ),
    );
  }

  return deliverNotifications(route.id, deliveries);
}

export function notifyRideAssigned({
  route,
  driver,
  priorDriverId,
  previousDriver,
  unchanged,
}: {
  route: NotificationRoute;
  driver: NotificationUser;
  priorDriverId: string | null;
  previousDriver: NotificationUser | null;
  unchanged: boolean;
}): Promise<void> {
  // A repeated save should not announce an assignment again.
  if (unchanged) return Promise.resolve();

  const { student } = route;
  const driverName = `${driver.firstName} ${driver.lastName}`;
  const rideTime = `${formatEstDate(route.scheduledPickupTime)} ${formatEstTime(route.scheduledPickupTime)}`;

  const driverChanged = previousDriver != null;
  const vehicleOnly = priorDriverId != null && !driverChanged;

  const studentNotification = vehicleOnly
    ? RIDE_NOTIFICATIONS.studentVehicleChanged(rideTime)
    : driverChanged
      ? RIDE_NOTIFICATIONS.studentDriverChanged(rideTime, driverName)
      : RIDE_NOTIFICATIONS.studentDriverAssigned(driverName);

  const driverNotification = vehicleOnly
    ? RIDE_NOTIFICATIONS.driverVehicleChanged(rideTime)
    : RIDE_NOTIFICATIONS.driverAssigned();

  const deliveries: Delivery[] = [
    () => emitToast(student.id, "Student", studentNotification),

    () => emitToast(driver.id, "Driver", driverNotification),
  ];

  if (previousDriver) {
    deliveries.push(() =>
      emitToast(
        previousDriver.id,
        "Driver",
        RIDE_NOTIFICATIONS.driverReassigned(rideTime),
      ),
    );
  }

  if (!vehicleOnly && student.settings?.driverAssigned) {
    deliveries.push(() => sendRideConfirmed(route.id));
  }

  if (!vehicleOnly && driver.settings?.rideAssigned) {
    deliveries.push(() =>
      sendRideAssigned(
        driver.email,
        recipientName(driver),
        getRideEmailDetails(route),
      ),
    );
  }

  return deliverNotifications(route.id, deliveries);
}

export function notifyRideChangesAccepted(
  route: NotificationRoute,
  previousDriver: NotificationUser | null,
): Promise<void> {
  const rideTime = `${formatEstDate(route.scheduledPickupTime)} ${formatEstTime(route.scheduledPickupTime)}`;

  const details = `Pickup: ${route.pickup.name} on ${rideTime}. Dropoff: ${route.dropoff.name}. Vehicle: ${route.vehicle?.licensePlate ?? "Unassigned"}.`;

  const deliveries: Delivery[] = [
    () =>
      emitToast(
        route.student.id,
        "Student",
        RIDE_NOTIFICATIONS.changesAccepted(
          route.status === RouteStatus.Requested,
        ),
      ),
  ];

  if (route.driver) {
    const driver = route.driver;

    deliveries.push(() =>
      emitToast(
        driver.id,
        "Driver",
        RIDE_NOTIFICATIONS.driverRideUpdated(details),
      ),
    );

    if (driver.settings?.rideAssigned)
      deliveries.push(() =>
        sendRideUpdated(driver.email, recipientName(driver), {
          ...getRideEmailDetails(route),
          message: details,
        }),
      );
  }

  if (previousDriver && previousDriver.id !== route.driverId) {
    const notification = RIDE_NOTIFICATIONS.driverRideReleased(rideTime);

    deliveries.push(() => emitToast(previousDriver.id, "Driver", notification));

    if (previousDriver.settings?.rideAssigned)
      deliveries.push(() =>
        sendRideUpdated(previousDriver.email, recipientName(previousDriver), {
          ...getRideEmailDetails(route),
          message: notification.message,
          rideUrl: new URL("/rides", process.env.DEPLOY_PRIME_URL!).href,
        }),
      );
  }

  return deliverNotifications(route.id, deliveries);
}
