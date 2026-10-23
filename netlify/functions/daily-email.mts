import type { Config, Handler } from "@netlify/functions";
import { routeStatusLabels } from "@/utils/route-status";
import { EmailClient } from "@/server/email/EmailClient";
import {
  getDailySummaryRoutes,
  getDailySummaryUsers,
} from "@/server/db/actions/EmailAction";
import {
  endOfEstDay,
  formatEstDate,
  formatEstTime,
  startOfEstDay,
} from "@/utils/dateEst";
export const config: Config = { schedule: "0 12 * * *" };

const handler: Handler = async () => {
  const day = new Date();
  const [dayStart, dayEnd] = [startOfEstDay(day), endOfEstDay(day)];
  const optedInUsers = await getDailySummaryUsers();
  if (optedInUsers.length === 0)
    return { statusCode: 200, body: "No users opted in to daily summaries." };
  const userIds = optedInUsers.map((user) => user.id);
  const routes = await getDailySummaryRoutes(userIds, dayStart, dayEnd);
  const usersById = new Map(optedInUsers.map((user) => [user.id, user]));
  const ridesByUserId = new Map<string, (typeof routes)[number][]>();

  for (const route of routes) {
    const recipientIds = [route.studentId, route.driverId].filter(
      (id): id is string => Boolean(id),
    );
    for (const userId of recipientIds) {
      if (usersById.has(userId)) {
        const rides = ridesByUserId.get(userId) ?? [];
        rides.push(route);
        ridesByUserId.set(userId, rides);
      }
    }
  }

  const deliveries = [...ridesByUserId.entries()].map(
    async ([userId, rides]) => {
      const user = usersById.get(userId);
      if (!user) return;

      await EmailClient.dailySummary(
        user.email,
        user.preferredName ?? `${user.firstName} ${user.lastName}`,
        rides.map((ride) => ({
          rideId: ride.id,
          date: formatEstDate(ride.scheduledPickupTime),
          time: formatEstTime(ride.scheduledPickupTime),
          pickup: ride.pickup.name,
          dropoff: ride.dropoff.name,
          status: routeStatusLabels[ride.status],
        })),
      );
    },
  );

  const results = await Promise.allSettled(deliveries);
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length > 0) {
    console.error(`Failed to send ${failures.length} daily ride summaries.`);
    return {
      statusCode: 500,
      body: `Sent ${results.length - failures.length} summaries; ${failures.length} failed.`,
    };
  }

  return {
    statusCode: 200,
    body: `Sent ${results.length} daily ride summaries.`,
  };
};

export default handler;
