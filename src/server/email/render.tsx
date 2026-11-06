import RideCompletedEmail from "../../../emails/RideCompleted";
import RideUpdatedEmail from "../../../emails/RideUpdated";
import RideAssignedEmail from "../../../emails/RideAssigned";
import DriverEnRouteEmail from "../../../emails/DriverEnRoute";
import RideCancelledEmail from "../../../emails/RideCancelled";
import type { ComponentProps, ReactElement } from "react";
import { render, toPlainText } from "react-email";
import NewMessageFromDriverEmail from "../../../emails/NewMessageFromDriver";
import RideConfirmationEmail from "../../../emails/RideConfirmed";
import RideDelayedEmail from "../../../emails/RideDelayed";

async function renderTemplate(template: ReactElement) {
  const html = await render(template);
  return { html, text: toPlainText(html) };
}

export function renderRideConfirmed(
  props: ComponentProps<typeof RideConfirmationEmail>,
) {
  return renderTemplate(<RideConfirmationEmail {...props} />);
}

export type RideDelay = Pick<
  ComponentProps<typeof RideDelayedEmail>,
  | "oldDropoffTime"
  | "newDropoffTime"
  | "oldPickupTime"
  | "newPickupTime"
  | "delay"
>;

export function renderRideDelayed(
  props: ComponentProps<typeof RideDelayedEmail>,
) {
  return renderTemplate(<RideDelayedEmail {...props} />);
}

export function renderNewMessageFromDriver(
  props: ComponentProps<typeof NewMessageFromDriverEmail>,
) {
  return renderTemplate(<NewMessageFromDriverEmail {...props} />);
}

export type RideEmailDetails = Omit<
  ComponentProps<typeof RideConfirmationEmail>,
  "name"
>;

export function renderRideCancelled(
  props: ComponentProps<typeof RideCancelledEmail>,
) {
  return renderTemplate(<RideCancelledEmail {...props} />);
}

export function renderDriverEnRoute(
  props: ComponentProps<typeof DriverEnRouteEmail>,
) {
  return renderTemplate(<DriverEnRouteEmail {...props} />);
}

export function renderRideAssigned(
  props: ComponentProps<typeof RideAssignedEmail>,
) {
  return renderTemplate(<RideAssignedEmail {...props} />);
}

export function renderRideUpdated(
  props: ComponentProps<typeof RideUpdatedEmail>,
) {
  return renderTemplate(<RideUpdatedEmail {...props} />);
}

export function renderRideCompleted(
  props: ComponentProps<typeof RideCompletedEmail>,
) {
  return renderTemplate(<RideCompletedEmail {...props} />);
}
