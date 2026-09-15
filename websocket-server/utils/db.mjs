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

// The chat record itself is created (on schedule) and archived (on
// completion/cancellation/missing) by RouteAction.ts in the Next.js app —
// tied to the route's actual status transitions rather than to a client's
// socket being connected. This process only reads and appends to it.
export async function getChatHistory(routeId) {
  const chatlogs = mongoose.connection.db.collection("chatlogs");
  const chatlog = await chatlogs.findOne(
    { routeId: mongoose.Types.ObjectId.createFromHexString(routeId) },
    { projection: { messages: 1 } },
  );
  return chatlog?.messages ?? [];
}

// Appends a message atomically via $push — safe under concurrent senders,
// unlike a read-modify-write of the whole document. Only matches (and thus
// only succeeds) while the chat is still active; returns false otherwise so
// callers can reject the message instead of silently dropping it.
export async function appendMessage(routeId, message) {
  const chatlogs = mongoose.connection.db.collection("chatlogs");
  const result = await chatlogs.findOneAndUpdate(
    {
      routeId: mongoose.Types.ObjectId.createFromHexString(routeId),
      status: "active",
    },
    { $push: { messages: message } },
  );
  return result !== null;
}
