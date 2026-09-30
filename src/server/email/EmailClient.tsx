import mongoose from "mongoose";
import connectMongoDB from "@/server/db/mongodb";
import RouteModel from "@/server/db/models/RouteModel";
import LocationModel from "@/server/db/models/LocationModel";
import UserModel from "@/server/db/models/UserModel";
import Chatlog from "@/server/db/models/ChatlogModel";
import { formatEstDate, formatEstTime } from "@/utils/dateEst";
import { EmailFailedToSendException } from "@/utils/exceptions/email";
import { junoEmailClient } from "@/server/juno/init";
import { render, toPlainText } from "react-email";
import type { ComponentProps } from "react";
import NewMessageFromDriverEmail from "../../../emails/NewMessageFromDriver";
import RideConfirmationEmail from "../../../emails/RideConfirmed";
import RideDelayedEmail from "../../../emails/RideDelayed";

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

export const EmailClient = {
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

  rideConfirmed: async (routeId: string) => {
    const context = await getRideEmailContext(routeId, "driverAssigned");
    if (!context) return;
    const { to, props } = context;
    const html = await render(<RideConfirmationEmail {...props} />);
    return sendEmail({
      to,
      toName: props.name,
      subject: `Ride confirmed for ${props.date}`,
      html,
      text: toPlainText(html),
    });
  },

  rideDelayed: async (
    routeId: string,
    delay: Pick<
      ComponentProps<typeof RideDelayedEmail>,
      | "oldDropoffTime"
      | "newDropoffTime"
      | "oldPickupTime"
      | "newPickupTime"
      | "delay"
    >,
  ) => {
    const context = await getRideEmailContext(routeId, "rideDelayed");
    if (!context) return;
    const { to, props } = context;
    const html = await render(<RideDelayedEmail {...props} {...delay} />);
    return sendEmail({
      to,
      toName: props.name,
      subject: `Ride delayed for ${props.date}`,
      html,
      text: toPlainText(html),
    });
  },

  newMessageFromDriver: async (routeId: string, messageId: string) => {
    const context = await getRideEmailContext(routeId, "newMessageFromDriver");
    if (!context) return;
    const chat = await Chatlog.findOne(
      { routeId, "messages._id": new mongoose.Types.ObjectId(messageId) },
      {
        messages: {
          $elemMatch: { _id: new mongoose.Types.ObjectId(messageId) },
        },
      },
    ).lean();
    const message = chat?.messages[0];
    if (!message || message.senderType !== "driver") return;

    const { to, props } = context;
    const html = await render(
      <NewMessageFromDriverEmail {...props} messages={[message.text]} />,
    );
    return sendEmail({
      to,
      toName: props.name,
      subject: "Your GT Paratransit driver just sent you a message",
      html,
      text: toPlainText(html),
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

async function getRideEmailContext(
  routeId: string,
  preference: "driverAssigned" | "newMessageFromDriver" | "rideDelayed",
) {
  await connectMongoDB();
  const route = await RouteModel.findById(routeId).lean();
  if (!route) return null;
  const student = await UserModel.findById(route.student._id).lean();
  if (!student?.settings?.notifications?.[preference]) return null;

  const [pickup, dropoff] = await Promise.all([
    LocationModel.findById(route.pickupLocation).lean(),
    LocationModel.findById(route.dropoffLocation).lean(),
  ]);
  const rideUrl = new URL(`/rides/${route._id}`, process.env.DEPLOY_PRIME_URL!)
    .href;
  return {
    to: student.email,
    props: {
      name: student.preferredName ?? `${student.firstName} ${student.lastName}`,
      date: formatEstDate(route.scheduledPickupTime, {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      pickupTime: formatEstTime(route.scheduledPickupTime),
      dropoffTime: route.estimatedDropoffTime
        ? formatEstTime(route.estimatedDropoffTime)
        : "Not yet estimated",
      pickupLocation: pickup?.name ?? "Pickup location unavailable",
      destination: dropoff?.name ?? "Destination unavailable",
      driverDetails:
        route.driver && route.vehicle
          ? {
              name: `${route.driver.firstName} ${route.driver.lastName}`,
              vehicleId: route.vehicle.vehicleId ?? route.vehicle.name,
              licensePlate: route.vehicle.licensePlate,
              description: route.vehicle.description ?? "",
            }
          : undefined,
      rideUrl,
      chatUrl: `${rideUrl}?chat=1`,
    },
  };
}
