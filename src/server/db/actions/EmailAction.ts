import { EmailFailedToSendException } from "@/utils/exceptions/email";
import { junoEmailClient } from "@/server/juno/init";
import { EmailSender, EmailRecipient } from "juno-sdk/internal/api";

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
  const sender: EmailSender = {
    email: process.env.JUNO_EMAIL_SENDER_EMAIL ?? "bitsgood85@gmail.com",
    name: process.env.JUNO_EMAIL_SENDER_NAME ?? "Able Alliance",
  };

  const recipients: EmailRecipient[] = [
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

  console.log("📧 Attempting to send email via Juno...");
  console.log("Sender:", sender);
  console.log("Recipients:", recipients);
  console.log("Subject:", subject);
  console.log("Contents:", contents);

  const res = await junoEmailClient.sendEmail({
    sender,
    recipients,
    cc: [],
    bcc: [],
    subject,
    contents,
  });

  console.log("✅ Juno response:", JSON.stringify(res, null, 2));

  if (!res.success) {
    console.error("❌ Email send failed. Response:", res);
    throw new EmailFailedToSendException(
      `Email failed to send: ${JSON.stringify(res)}`,
    );
  }

  console.log("✅ Email sent successfully!");
}

/**
 * Template helper functions for common email types
 */
export const EmailTemplates = {
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

  driverArriving: (
    to: string,
    toName: string,
    driverDetails: { name: string; eta: string; vehicle: string },
  ) => {
    return sendEmail({
      to,
      toName,
      subject: "Your Driver is Arriving",
      html: `
        <h1>Your Driver is On the Way!</h1>
        <p><strong>Driver:</strong> ${driverDetails.name}</p>
        <p><strong>Vehicle:</strong> ${driverDetails.vehicle}</p>
        <p><strong>ETA:</strong> ${driverDetails.eta}</p>
        <p>Please be ready at your pickup location.</p>
      `,
    });
  },

  rideCompleted: (
    to: string,
    toName: string,
    rideDetails: { rideId: string; cost: string; distance: string },
  ) => {
    return sendEmail({
      to,
      toName,
      subject: "Ride Completed - Thank You!",
      html: `
        <h1>Thank You for Riding with Able Alliance!</h1>
        <p><strong>Ride ID:</strong> ${rideDetails.rideId}</p>
        <p><strong>Distance:</strong> ${rideDetails.distance}</p>
        <p><strong>Cost:</strong> $${rideDetails.cost}</p>
        <p>We hope to see you again soon!</p>
      `,
    });
  },
};
