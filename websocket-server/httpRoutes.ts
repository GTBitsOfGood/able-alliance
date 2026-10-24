import type { Express } from "express";
import type { AppNamespace } from "./types.js";
import { debugLog } from "./utils/logger.js";

export function registerHttpRoutes(
  app: Express,
  notificationsNsp: AppNamespace,
) {
  app.get("/", (req, res) => {
    res.json({ message: "Express server running", ok: true });
  });
  app.get("/health", (req, res) => {
    res.status(200).send("OK");
  });

  // Internal endpoint: the Next.js app calls this after a ride-status
  // transition to push a toast to the affected user's /notifications room.
  // Not exposed to browsers — protected by a shared secret, not user auth.
  app.post("/notify", (req, res) => {
    const secret = req.headers["x-internal-secret"];
    if (
      !process.env.WEBSOCKET_INTERNAL_SECRET ||
      secret !== process.env.WEBSOCKET_INTERNAL_SECRET
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { userId, type, message } = req.body ?? {};
    if (
      typeof userId !== "string" ||
      typeof type !== "string" ||
      typeof message !== "string"
    ) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const room = `user:${userId}`;
    const delivered = (notificationsNsp.adapter.rooms.get(room)?.size ?? 0) > 0;
    debugLog(
      `/notify: user=${userId} type=${type} delivered=${delivered} (room size=${notificationsNsp.adapter.rooms.get(room)?.size ?? 0})`,
    );

    notificationsNsp.to(room).emit("notification", { type, message });

    res.status(200).json({ ok: true, delivered });
  });

  // Internal endpoint: the Next.js app calls this after a route changes so
  // open clients (the route's users and all admins) can refetch.
  app.post("/events", (req, res) => {
    const secret = req.headers["x-internal-secret"];
    if (
      !process.env.WEBSOCKET_INTERNAL_SECRET ||
      secret !== process.env.WEBSOCKET_INTERNAL_SECRET
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { event, userIds, toAdmins, payload } = req.body ?? {};
    if (
      event !== "routeUpdated" ||
      !Array.isArray(userIds) ||
      !userIds.every((id: unknown) => typeof id === "string") ||
      typeof payload?.routeId !== "string" ||
      typeof payload?.status !== "string"
    ) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const rooms = (userIds as string[]).map((id) => `user:${id}`);
    if (toAdmins === true) rooms.push("role:admin");
    if (rooms.length === 0) {
      return res.status(200).json({ ok: true, recipients: 0 });
    }

    const recipients = rooms.reduce(
      (n, room) => n + (notificationsNsp.adapter.rooms.get(room)?.size ?? 0),
      0,
    );
    debugLog(
      `/events: ${event} route=${payload.routeId} status=${payload.status} rooms=[${rooms.join(",")}] sockets=${recipients}`,
    );

    // Passing all rooms to one .to() dedupes sockets that are in several.
    notificationsNsp.to(rooms).emit("routeUpdated", {
      routeId: payload.routeId,
      status: payload.status,
    });

    res.status(200).json({ ok: true, recipients });
  });
}
