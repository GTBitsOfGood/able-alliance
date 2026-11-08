import { after, NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { idSchema } from "@/schemas/id";
import { getEmailRoute } from "@/server/actions/EmailAction";
import { sendNewMessageFromDriver } from "@/server/email/email";
import { getRouteMessage } from "@/server/actions/MessageAction";
import { emitToast } from "@/server/notifications/emitToast";
import { RIDE_NOTIFICATIONS } from "@/utils/consts";
import { UserType } from "@db/generated/enums";

const requestSchema = z.object({
  routeId: idSchema,
  messageId: idSchema,
});

export async function POST(req: NextRequest) {
  let userId: string;

  try {
    const authorization = req.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) throw new Error("Missing token");

    const claims = jwt.verify(
      authorization.slice(7),
      process.env.NEXTAUTH_SECRET!,
      {
        algorithms: ["HS256"],
      },
    );

    userId = z.object({ userId: z.string() }).parse(claims).userId;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = requestSchema.safeParse(await req.json().catch(() => null));

  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { routeId, messageId } = body.data;

  try {
    const route = await getEmailRoute(routeId);

    if (route?.driverId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const message = await getRouteMessage(routeId, messageId);

    if (
      !message ||
      message.senderId !== userId ||
      message.senderType !== UserType.Driver
    ) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Start both deliveries independently. Track the toast after the response
    // so a slow websocket service never delays email or its HTTP result.
    const toastDelivery = emitToast(
      route.student.id,
      "Student",
      RIDE_NOTIFICATIONS.driverMessage(message.text),
    );
    after(() => toastDelivery);

    await sendNewMessageFromDriver(routeId, messageId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Driver-message email failed:", error);

    return NextResponse.json(
      { error: "Email notification failed" },
      { status: 500 },
    );
  }
}
