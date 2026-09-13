import type { Config, Handler } from "@netlify/functions";
import connectMongoDB from "../../src/server/db/mongodb";
import RouteModel from "../../src/server/db/models/RouteModel";
import { UserModel } from "../../src/server/db/models/UserModel";
import { EmailTemplates } from "../../src/server/email/EmailAction";
import {
  endOfEstDay,
  formatEstDate,
  formatEstTime,
  startOfEstDay,
} from "../../src/utils/dateEst";

export const config: Config = {
  // 7 AM EST
  schedule: "0 12 * * *",
};

type UserForSummary = {
  _id: { toString(): string };
  firstName: string;
  lastName: string;
  preferredName?: string;
  email: string;
  type: "Student" | "Driver";
};

type RouteForSummary = {
  _id: { toString(): string };
  scheduledPickupTime: Date;
  status: string;
  student: { _id: { toString(): string } };
  driver?: { _id: { toString(): string } };
  pickupLocation: { name: string };
  dropoffLocation: { name: string };
};

const handler: Handler = async () => {
  await connectMongoDB();

  const day = new Date();
  const [dayStart, dayEnd] = [startOfEstDay(day), endOfEstDay(day)];
  const optedInUsers = (await UserModel.find({
    type: { $in: ["Student", "Driver"] },
    "settings.notifications.dailySummary": true,
  })
    .select("firstName lastName preferredName email type")
    .lean()) as unknown as UserForSummary[];

  if (optedInUsers.length === 0) {
    return { statusCode: 200, body: "No users opted in to daily summaries." };
  }

  const userIds = optedInUsers.map((user) => user._id);
  const routes = (await RouteModel.find({
    scheduledPickupTime: { $gte: dayStart, $lte: dayEnd },
    $or: [
      { "student._id": { $in: userIds } },
      { "driver._id": { $in: userIds } },
    ],
  })
    .populate([
      { path: "pickupLocation", select: "name" },
      { path: "dropoffLocation", select: "name" },
    ])
    .lean()) as unknown as RouteForSummary[];

  const usersById = new Map(
    optedInUsers.map((user) => [user._id.toString(), user]),
  );
  const ridesByUserId = new Map<string, RouteForSummary[]>();

  for (const route of routes) {
    const recipientIds = [
      route.student._id.toString(),
      route.driver?._id.toString(),
    ].filter((id): id is string => Boolean(id));
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

      await EmailTemplates.dailySummary(
        user.email,
        user.preferredName ?? `${user.firstName} ${user.lastName}`,
        rides.map((ride) => ({
          rideId: ride._id.toString(),
          date: formatEstDate(ride.scheduledPickupTime),
          time: formatEstTime(ride.scheduledPickupTime),
          pickup: ride.pickupLocation.name,
          dropoff: ride.dropoffLocation.name,
          status: ride.status,
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
