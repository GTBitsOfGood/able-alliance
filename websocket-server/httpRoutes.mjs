import { debugLog } from "./utils/logger.mjs";

export function registerHttpRoutes(app, notificationsNsp) {
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
}
