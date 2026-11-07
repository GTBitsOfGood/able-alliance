import { db } from "@db";
import { Prisma, RouteStatus } from "@db/generated/client";
import { z } from "zod";
import { recordAudit } from "@db/audit";

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

export function getChatHistory(routeId: string) {
  return db.message.findMany({
    where: { routeId: routeId.toLowerCase() },
    orderBy: [{ time: "asc" }, { id: "asc" }],
  });
}

const closedChatStatuses = new Set<RouteStatus>([
  RouteStatus.Completed,
  RouteStatus.Missing,
  RouteStatus.CancelledByStudent,
  RouteStatus.CancelledByAdmin,
]);

/** True once the ride has ended, by any route — the chat room may close. */
export function isChatClosed(status: RouteStatus) {
  return closedChatStatuses.has(status);
}

export function getRouteStatus(routeId: string) {
  if (!routeIdSchema.safeParse(routeId).success)
    throw new Error("Invalid route ID");
  return db.route.findUnique({
    where: { id: routeId.toLowerCase() },
    select: { status: true },
  });
}

/**
 * Appends a chat message.
 *
 * `clientId` is the sender's id for this send attempt. Retrying with the same
 * one returns the message already stored instead of writing a second copy, so
 * a client whose acknowledgement was lost can retry safely.
 */
export async function appendMessage(
  routeId: string,
  senderId: string,
  text: string,
  clientId?: string,
) {
  const route = await db.route.findUnique({
    where: { id: routeId },
    select: { status: true },
  });

  if (!route || closedChatStatuses.has(route.status)) {
    throw new Error("Chat is closed for this route");
  }

  if (clientId) {
    const existing = await db.message.findUnique({
      where: { senderId_clientId: { senderId, clientId } },
    });
    if (existing) return existing;
  }

  try {
    return await db.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          route: { connect: { id: routeId } },
          sender: { connect: { id: senderId } },
          text,
          time: new Date(),
          clientId,
        },
      });
      await recordAudit(tx, {
        actorId: senderId,
        entityType: "Message",
        entityId: message.id,
        action: "Create",
        after: message,
      });
      return message;
    });
  } catch (error) {
    // Two retries of the same attempt can race past the check above; the
    // unique index settles it and the loser returns the stored message.
    if (
      clientId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const stored = await db.message.findUnique({
        where: { senderId_clientId: { senderId, clientId } },
      });
      if (stored) return stored;
    }
    throw error;
  }
}
