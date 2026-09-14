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

// This process never loads the Next.js app's Mongoose Chatlog model (see
// RouteModel.ts comment on the same pattern for routes), so it can't rely on
// Mongoose's autoIndex to have created this — it must ensure it itself.
// Without this, a race between two upserts in ensureActiveChatlog can create
// two chat records for the same route (verified: it does, under load).
export async function ensureChatlogIndexes() {
  const chatlogs = mongoose.connection.db.collection("chatlogs");
  await chatlogs.createIndex({ routeId: 1 }, { unique: true });
}

// Creates the ride's chat record if it doesn't exist yet, atomically. The
// upsert (rather than a separate find-then-insert) plus the unique index on
// routeId (see ensureChatlogIndexes) is what guarantees only one chat record
// ever exists per route, even if two participants connect at the same
// instant. Under that exact race, MongoDB can reject the losing upsert with
// a duplicate-key error (E11000) instead of silently converting it to a
// match — that's expected and means the record already exists, not a
// failure, so it's swallowed rather than propagated.
export async function ensureActiveChatlog(routeId, student, driver) {
  const chatlogs = mongoose.connection.db.collection("chatlogs");
  try {
    await chatlogs.findOneAndUpdate(
      { routeId: mongoose.Types.ObjectId.createFromHexString(routeId) },
      {
        $setOnInsert: {
          routeId: mongoose.Types.ObjectId.createFromHexString(routeId),
          student,
          driver,
          time: new Date(),
          status: "active",
          messages: [],
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
  }
}

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

export async function archiveChatlog(routeId) {
  const chatlogs = mongoose.connection.db.collection("chatlogs");
  await chatlogs.findOneAndUpdate(
    {
      routeId: mongoose.Types.ObjectId.createFromHexString(routeId),
      status: "active",
    },
    { $set: { status: "archived", archivedAt: new Date() } },
  );
}
