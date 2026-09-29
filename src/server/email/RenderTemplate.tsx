import { render, toPlainText } from "react-email";
import NewMessageFromDriverEmail from "../../../emails/NewMessageFromDriver";
import RideConfirmationEmail from "../../../emails/RideConfirmed";
import RideDelayedEmail from "../../../emails/RideDelayed";

export async function renderNewMessageFromDriverEmail(props: {
  dropoffTime: string;
  pickupTime: string;
  pickupLocation: string;
  destination: string;
  date: string;
  messages: string[];
  rideUrl: string;
  chatUrl: string;
}) {
  const html = await render(<NewMessageFromDriverEmail {...props} />);
  const text = toPlainText(html);
  return { html, text };
}

export async function renderRideConfirmationEmail(props: {
  dropoffTime: string;
  pickupTime: string;
  pickupLocation: string;
  destination: string;
  date: string;
  name: string;
  driverDetails?: {
    name: string;
    vehicleId: string;
    licensePlate: string;
    description: string;
  };
  rideUrl: string;
  chatUrl?: string;
  mapImgUrl?: string;
}) {
  const html = await render(<RideConfirmationEmail {...props} />);
  const text = toPlainText(html);
  return { html, text };
}

export async function renderRideDelayedEmail(props: {
  oldDropoffTime: string;
  newDropoffTime: string;
  oldPickupTime: string;
  newPickupTime: string;
  pickupLocation: string;
  destination: string;
  date: string;
  delay: string;
  name: string;
  rideUrl: string;
  driverDetails?: {
    name: string;
    vehicleId: string;
    licensePlate: string;
    description: string;
  };
  chatUrl?: string;
  mapImgUrl?: string;
}) {
  const html = await render(<RideDelayedEmail {...props} />);
  const text = toPlainText(html);
  return { html, text };
}
