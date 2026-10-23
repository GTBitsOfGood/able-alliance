import { db } from "@db";
import { routeInclude } from "@/server/db/queries";

/** Route and user records used by ride email rendering. */
export const getEmailRoute = (routeId: string) =>
  db.route.findUnique({
    where: { id: routeId.toLowerCase() },
    include: routeInclude,
  });

export const getDailySummaryUsers = () =>
  db.user.findMany({
    where: {
      type: { in: ["Student", "Driver"] },
      settings: { is: { dailySummary: true } },
    },
  });

export const getDailySummaryRoutes = (
  userIds: string[],
  dayStart: Date,
  dayEnd: Date,
) =>
  db.route.findMany({
    include: {
      pickup: { select: { name: true } },
      dropoff: { select: { name: true } },
    },
    where: {
      scheduledPickupTime: { gte: dayStart, lte: dayEnd },
      OR: [{ studentId: { in: userIds } }, { driverId: { in: userIds } }],
    },
  });
