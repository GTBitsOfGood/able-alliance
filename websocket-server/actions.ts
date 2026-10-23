import { db } from "@db";
import { RouteStatus } from "@db/generated/client";
import { z } from "zod";

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
      scheduledPickupTime: true,
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

export async function appendMessage(
  routeId: string,
  senderId: string,
  text: string,
) {
  const route = await db.route.findUnique({
    where: { id: routeId },
    select: { status: true },
  });

  if (!route || closedChatStatuses.has(route.status)) {
    throw new Error("Chat is closed for this route");
  }

  return db.message.create({
    data: {
      route: { connect: { id: routeId } },
      sender: { connect: { id: senderId } },
      text,
      time: new Date(),
    },
  });
}
