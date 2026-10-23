import { db } from "@db";
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

export function appendMessage(routeId: string, senderId: string, text: string) {
  return db.message.create({
    data: {
      route: { connect: { id: routeId.toLowerCase() } },
      sender: { connect: { id: senderId } },
      text,
      time: new Date(),
    },
  });
}
