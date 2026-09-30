import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { z } from "zod";
import connectMongoDB from "@/server/db/mongodb";
import RouteModel from "@/server/db/models/RouteModel";
import { EmailClient } from "@/server/email/EmailClient";

const requestSchema = z.object({
  routeId: z.string().regex(/^[a-f\d]{24}$/i),
  messageId: z.string().regex(/^[a-f\d]{24}$/i),
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
    await connectMongoDB();
    const route = await RouteModel.findById(routeId).lean();
    if (route?.driver?._id.toString() !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await EmailClient.newMessageFromDriver(routeId, messageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Driver-message email failed:", error);
    return NextResponse.json(
      { error: "Email notification failed" },
      { status: 500 },
    );
  }
}
