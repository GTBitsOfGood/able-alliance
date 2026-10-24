import { db } from "@db";

export const getMessagesForRoute = (routeId: string) =>
  db.message.findMany({
    where: { routeId: routeId.toLowerCase() },
    orderBy: [{ time: "asc" }, { id: "asc" }],
  });

export const getRouteMessage = (routeId: string, messageId: string) =>
  db.message.findFirst({
    where: {
      id: messageId.toLowerCase(),
      routeId: routeId.toLowerCase(),
    },
  });
