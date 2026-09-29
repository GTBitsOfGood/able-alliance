import { EmailFailedToSendException } from "@/utils/exceptions/email";
import { junoEmailClient } from "@/server/juno/init";
import {
  renderNewMessageFromDriverEmail,
  renderRideDelayedEmail,
  renderRideConfirmationEmail,
} from "./RenderTemplate";

/**
 * Send a transactional email via Juno
 * @param to - Recipient email address
 * @param toName - Recipient name (optional)
 * @param subject - Email subject
 * @param html - HTML email content (optional)
 * @param text - Plain text email content (optional)
 */
export async function sendEmail({
  to,
  toName,
  subject,
  html,
  text,
}: {
  to: string;
  toName?: string;
  subject: string;
  html?: string;
  text?: string;
}) {
  const sender = {
    email: process.env.JUNO_EMAIL_SENDER_EMAIL ?? "bitsgood85@gmail.com",
    name: process.env.JUNO_EMAIL_SENDER_NAME ?? "Able Alliance",
  };

  const recipients = [
    {
      email: to,
      name: toName,
    },
  ];

  const contents = [];
  if (html) {
    contents.push({
      type: "text/html",
      value: html,
    });
  }
  if (text) {
    contents.push({
      type: "text/plain",
      value: text,
    });
  }

  const res = await junoEmailClient.sendEmail({
    sender,
    recipients,
    cc: [],
    bcc: [],
    subject,
    contents,
  });

  if (!res.success) {
    throw new EmailFailedToSendException(
      `Email failed to send: ${JSON.stringify(res)}`,
    );
  }
}

/**
 * Template helper functions for common email types
 */
export const EmailNotifications = {
  driverAssigned: (
    to: string,
    toName: string,
    driverDetails: { name: string; vehicle: string },
  ) => {
    return sendEmail({
      to,
      toName,
      subject: "Driver Assigned",
      html: `
        <h1>Your Driver Has Been Assigned</h1>
        <p><strong>Driver:</strong> ${driverDetails.name}</p>
        <p><strong>Vehicle:</strong> ${driverDetails.vehicle}</p>
      `,
    });
  },

  rideCancelled: (
    to: string,
    toName: string,
    rideDetails: { rideId: string; reason?: string },
  ) => {
    return sendEmail({
      to,
      toName,
      subject: "Ride Cancelled",
      html: `
        <h1>Your Ride Has Been Cancelled</h1>
        <p>Ride ID: ${rideDetails.rideId}</p>
        ${rideDetails.reason ? `<p>Reason: ${rideDetails.reason}</p>` : ""}
        <p>If you have any questions, please contact support.</p>
      `,
    });
  },

  driverEnRoute: (
    to: string,
    toName: string,
    driverDetails: { name: string; eta: string; vehicle: string },
  ) => {
    return sendEmail({
      to,
      toName,
      subject: "Your Driver is En Route",
      html: `
        <h1>Your Driver is On the Way!</h1>
        <p><strong>Driver:</strong> ${driverDetails.name}</p>
        <p><strong>Vehicle:</strong> ${driverDetails.vehicle}</p>
        <p><strong>ETA:</strong> ${driverDetails.eta}</p>
        <p>Please be ready at your pickup location.</p>
      `,
    });
  },

  rideAssigned: (
    to: string,
    toName: string,
    rideDetails: {
      rideId: string;
      pickup: string;
      dropoff: string;
      time: string;
    },
  ) => {
    return sendEmail({
      to,
      toName,
      subject: "Ride Assigned",
      html: `
        <h1>You Have Been Assigned a Ride</h1>
        <p><strong>Ride ID:</strong> ${rideDetails.rideId}</p>
        <p><strong>Pickup:</strong> ${rideDetails.pickup}</p>
        <p><strong>Dropoff:</strong> ${rideDetails.dropoff}</p>
        <p><strong>Time:</strong> ${rideDetails.time}</p>
      `,
    });
  },

  rideCompleted: (
    to: string,
    toName: string,
    rideDetails: { rideId: string },
  ) => {
    return sendEmail({
      to,
      toName,
      subject: "Ride Completed - Thank You!",
      html: `
        <h1>Thank You for Riding with Able Alliance!</h1>
        <p><strong>Ride ID:</strong> ${rideDetails.rideId}</p>
        <p>We hope to see you again soon!</p>
      `,
    });
  },

  rideConfirmed: async (
    to: string,
    toName: string,
    rideDetails: {
      dropoffTime: string;
      pickupTime: string;
      pickupLocation: string;
      destination: string;
      date: string;
      time: string;
    },
    driverDetails?: {
      name: string;
      vehicleId: string;
      licensePlate: string;
      description: string;
    },
  ) => {
    const { html, text } = await renderRideConfirmationEmail({
      date: rideDetails.date,
      pickupLocation: rideDetails.pickupLocation,
      destination: rideDetails.destination,
      dropoffTime: rideDetails.dropoffTime,
      pickupTime: rideDetails.pickupTime,
      driverDetails: driverDetails,
      name: toName,
    });

    return sendEmail({
      to,
      toName,
      subject: `Ride confirmed for ${rideDetails.date}`,
      html,
      text,
    });
  },

  rideDelayed: async (
    to: string,
    toName: string,
    rideDetails: {
      oldDropoffTime: string;
      newDropoffTime: string;
      oldPickupTime: string;
      newPickupTime: string;
      pickupLocation: string;
      destination: string;
      date: string;
      delay: string;
      driverDetails?: {
        name: string;
        vehicleId: string;
        licensePlate: string;
        description: string;
      };
    },
  ) => {
    const { html, text } = await renderRideDelayedEmail({
      oldDropoffTime: rideDetails.oldDropoffTime,
      newDropoffTime: rideDetails.newDropoffTime,
      oldPickupTime: rideDetails.oldPickupTime,
      newPickupTime: rideDetails.newPickupTime,
      pickupLocation: rideDetails.pickupLocation,
      destination: rideDetails.destination,
      date: rideDetails.date,
      delay: rideDetails.delay,
      driverDetails: rideDetails.driverDetails,
      name: toName,
    });

    return sendEmail({
      to,
      toName,
      subject: `Ride delayed for ${rideDetails.date}`,
      html,
      text,
    });
  },

  newMessageFromDriver: async (
    to: string,
    toName: string,
    rideDetails: {
      dropoffTime: string;
      pickupTime: string;
      pickupLocation: string;
      destination: string;
      date: string;
      messages: string[];
    },
  ) => {
    const { html, text } = await renderNewMessageFromDriverEmail({
      dropoffTime: rideDetails.dropoffTime,
      pickupTime: rideDetails.pickupTime,
      pickupLocation: rideDetails.pickupLocation,
      destination: rideDetails.destination,
      date: rideDetails.date,
      messages: rideDetails.messages,
    });

    return sendEmail({
      to,
      toName,
      subject: "Your GT Parasit driver just sent you a message",
      html,
      text,
    });
  },

  dailySummary: (
    to: string,
    toName: string,
    rides: {
      rideId: string;
      date: string;
      time: string;
      pickup: string;
      dropoff: string;
      status: string;
    }[],
  ) => {
    return sendEmail({
      to,
      toName,
      subject: "Your Able Alliance Rides Today",
      html: `
        <h1>Today's Able Alliance Rides</h1>
        <p>Here is a summary of your rides:</p>
        <ul>
          ${rides
            .map(
              (ride) => `
                <li>
                  <strong>${ride.date} at ${ride.time}</strong> - ${ride.pickup} to ${ride.dropoff}<br />
                  Ride ID: ${ride.rideId}<br />
                  Status: ${ride.status}
                </li>`,
            )
            .join("")}
        </ul>
      `,
    });
  },
};
