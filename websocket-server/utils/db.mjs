import mongoose from "mongoose";

// Minimal route shape for auth — only the fields we need.
// Uses raw collection; no Mongoose model/schema (this process doesn't share
// the Next.js app's Mongoose models — see RouteModel.ts for the full shape).
export async function getRouteForAuth(routeId) {
  if (!mongoose.Types.ObjectId.isValid(routeId)) {
    throw new Error("Invalid route ID");
  }
  const routes = mongoose.connection.db.collection("routes");
  const route = await routes.findOne(
    { _id: mongoose.Types.ObjectId.createFromHexString(routeId) },
    {
      projection: { status: 1, driver: 1, student: 1, scheduledPickupTime: 1 },
    },
  );
  return route;
}

export async function saveChatLog({ routeId, student, driver, messages }) {
  const chatlogs = mongoose.connection.db.collection("chatlogs");
  await chatlogs.insertOne({
    routeId: mongoose.Types.ObjectId.createFromHexString(routeId),
    student,
    driver,
    time: new Date(),
    messages,
  });
}
