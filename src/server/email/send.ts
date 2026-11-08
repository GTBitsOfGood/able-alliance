import nodemailer from "nodemailer";
import { EmailFailedToSendException } from "@/utils/errors";
import { previewEmail } from "./preview";

export type Email = {
  to: string;
  toName?: string;
  subject: string;
} & ({ html: string; text?: string } | { html?: string; text: string });

/** Send through Upsun's SMTP proxy, or preview when SMTP is not configured. */
export async function sendEmail(email: Email): Promise<void> {
  const { to, toName, subject, html, text } = email;
  const host = process.env.PLATFORM_SMTP_HOST?.trim();
  if (!host) {
    await previewEmail(email);
    return;
  }

  const transport = nodemailer.createTransport({
    host,
    port: 25,
    secure: false,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });

  try {
    const result = await transport.sendMail({
      from: {
        name: "GT Paratransit",
        address: "noreply-paratransit@hosting.gatech.edu",
      },
      to: { name: toName ?? "", address: to },
      subject,
      html,
      text,
      disableFileAccess: true,
      disableUrlAccess: true,
    });

    if (result.accepted.length === 0 || result.rejected.length > 0) {
      throw new Error("SMTP server did not accept the recipient");
    }
  } catch (cause) {
    throw new EmailFailedToSendException("Email failed to send", { cause });
  } finally {
    transport.close();
  }
}
