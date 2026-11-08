import { db } from "@db";
import { Prisma, RouteStatus, UserType } from "@db/generated/client";
import { z } from "zod";
import { recordAudit } from "@db/audit";
import type { Message, User } from "@db/generated/client";
import type { ChatMessage } from "./types.js";

const chatSenderSelect = {
  firstName: true,
  lastName: true,
  preferredName: true,
} as const;

function messageForChat({
  sender,
  ...message
}: Message & {
  sender: Pick<User, "firstName" | "lastName" | "preferredName">;
}): ChatMessage {
  return {
    ...message,
    author: {
      name: `${sender.preferredName || sender.firstName} ${sender.lastName}`.trim(),
      role:
        message.senderType === UserType.SuperAdmin
          ? UserType.Admin
          : message.senderType,
    },
  };
}

const routeIdSchema = z.uuid();

export const connectDatabase = () => db.$connect();

export async function getRouteForAuth(routeId: string) {
  if (!routeIdSchema.safeParse(routeId).success)
    throw new Error("Invalid route ID");
  return db.route.findUnique({
    where: { id: routeId.toLowerCase() },
    select: {
      driver: { select: { id: true } },
      student: { select: { id: true } },
    },
  });
}

export async function getChatHistory(routeId: string) {
  const messages = await db.message.findMany({
    where: { routeId: routeId.toLowerCase() },
    orderBy: [{ time: "asc" }, { id: "asc" }],
    include: { sender: { select: chatSenderSelect } },
  });
  return messages.map(messageForChat);
}

const closedChatStatuses = new Set<RouteStatus>([
  RouteStatus.Completed,
  RouteStatus.Missing,
  RouteStatus.CancelledByStudent,
  RouteStatus.CancelledByAdmin,
]);

export function isChatClosed(status: RouteStatus) {
  return closedChatStatuses.has(status);
}

export async function getRouteStatus(routeId: string) {
  if (!routeIdSchema.safeParse(routeId).success)
    throw new Error("Invalid route ID");
  return db.route.findUnique({
    where: { id: routeId.toLowerCase() },
    select: { status: true },
  });
}

export async function appendMessage(
  routeId: string,
  senderId: string,
  text: string,
  senderType: UserType,
) {
  const route = await getRouteStatus(routeId);

  if (!route || isChatClosed(route.status)) {
    throw new Error("Chat is closed for this route");
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${senderId}::uuid FOR UPDATE`,
    );
    const senderAccount = await tx.user.findUnique({
      where: { id: senderId },
      select: { status: true },
    });
    if (!senderAccount || senderAccount.status !== "active") {
      throw new Error("Account is inactive");
    }

    const created = await tx.message.create({
      data: {
        route: { connect: { id: routeId } },
        sender: { connect: { id: senderId } },
        senderType,
        text,
        time: new Date(),
      },
      include: { sender: { select: chatSenderSelect } },
    });
    const { sender, ...message } = created;
    await recordAudit(tx, {
      actorId: senderId,
      entityType: "Message",
      entityId: message.id,
      action: "Create",
      after: message,
    });
    return messageForChat({ ...message, sender });
  });
}
