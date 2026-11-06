import { formatEstDate, formatEstTime } from "@/utils/dateEst";
import { sendEmail } from "@/server/email/send";
import {
  renderRideCancelled,
  renderDriverEnRoute,
  renderRideAssigned,
  renderRideUpdated,
  renderRideCompleted,
  type RideEmailDetails,
  renderRideConfirmed,
  renderRideDelayed,
  renderNewMessageFromDriver,
  type RideDelay,
} from "@/server/email/render";
import { getEmailRoute } from "@/server/actions/EmailAction";
import { getRouteMessage } from "@/server/actions/MessageAction";

export { sendEmail } from "@/server/email/send";

export async function sendRideCancelled(
  to: string,
  toName: string,
  details: RideEmailDetails & { reason?: string },
) {
  const content = await renderRideCancelled({ ...details, name: toName });
  return sendEmail({ to, toName, subject: "Ride Cancelled", ...content });
}

export async function sendDriverEnRoute(
  to: string,
  toName: string,
  details: RideEmailDetails,
) {
  const content = await renderDriverEnRoute({ ...details, name: toName });
  return sendEmail({
    to,
    toName,
    subject: "Your Driver is En Route",
    ...content,
  });
}

export async function sendRideAssigned(
  to: string,
  toName: string,
  details: RideEmailDetails,
) {
  const content = await renderRideAssigned({ ...details, name: toName });
  return sendEmail({ to, toName, subject: "Ride Assigned", ...content });
}

export async function sendRideUpdated(
  to: string,
  toName: string,
  details: RideEmailDetails & { message: string },
) {
  const content = await renderRideUpdated({ ...details, name: toName });
  return sendEmail({ to, toName, subject: "Ride Updated", ...content });
}

export async function sendRideCompleted(
  to: string,
  toName: string,
  details: RideEmailDetails,
) {
  const content = await renderRideCompleted({ ...details, name: toName });
  return sendEmail({
    to,
    toName,
    subject: "Ride Completed - Thank You!",
    ...content,
  });
}

export async function sendRideConfirmed(routeId: string) {
  const context = await getRideEmailContext(routeId, "driverAssigned");
  if (!context) return;
  const { to, props } = context;
  const content = await renderRideConfirmed(props);
  return sendEmail({
    to,
    toName: props.name,
    subject: `Ride confirmed for ${props.date}`,
    ...content,
  });
}

export async function sendRideDelayed(routeId: string, delay: RideDelay) {
  const context = await getRideEmailContext(routeId, "rideDelayed");
  if (!context) return;
  const { to, props } = context;
  const content = await renderRideDelayed({ ...props, ...delay });
  return sendEmail({
    to,
    toName: props.name,
    subject: `Ride delayed for ${props.date}`,
    ...content,
  });
}

export async function sendNewMessageFromDriver(
  routeId: string,
  messageId: string,
) {
  const context = await getRideEmailContext(routeId, "newMessageFromDriver");
  if (!context) return;
  const message = await getRouteMessage(routeId, messageId);
  if (!message || message.senderId !== context.driverId) return;

  const { to, props } = context;
  const content = await renderNewMessageFromDriver({
    ...props,
    messages: [message.text],
  });
  return sendEmail({
    to,
    toName: props.name,
    subject: "Your GT Paratransit driver just sent you a message",
    ...content,
  });
}

async function getRideEmailContext(
  routeId: string,
  preference: "driverAssigned" | "newMessageFromDriver" | "rideDelayed",
) {
  const route = await getEmailRoute(routeId);
  if (!route) return null;
  const { student } = route;
  if (!student.settings?.[preference]) return null;

  return {
    driverId: route.driverId,
    to: student.email,
    props: {
      ...getRideEmailDetails(route),
      name: student.preferredName ?? `${student.firstName} ${student.lastName}`,
    },
  };
}

export function getRideEmailDetails(
  route: NonNullable<Awaited<ReturnType<typeof getEmailRoute>>>,
): RideEmailDetails & { chatUrl: string } {
  const { driver, vehicle, pickup, dropoff } = route;
  const rideUrl = new URL(`/rides/${route.id}`, process.env.DEPLOY_PRIME_URL!)
    .href;
  return {
    date: formatEstDate(route.scheduledPickupTime, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    pickupTime: formatEstTime(route.scheduledPickupTime),
    dropoffTime: route.estimatedDropoffTime
      ? formatEstTime(route.estimatedDropoffTime)
      : "Not yet estimated",
    pickupLocation: pickup.name,
    destination: dropoff.name,
    driverDetails:
      driver && vehicle
        ? {
            name: `${driver.firstName} ${driver.lastName}`,
            vehicleId: vehicle.vehicleId ?? vehicle.name,
            licensePlate: vehicle.licensePlate,
            description: vehicle.description ?? "",
          }
        : undefined,
    rideUrl,
    chatUrl: `${rideUrl}?chat=1`,
  };
}
