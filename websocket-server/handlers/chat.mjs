import { appendMessage } from "../utils/db.mjs";
import { debugLog } from "../utils/logger.mjs";

export function registerChatHandler(io, socket, room, chatReady) {
  socket.on("sendChatMessage", async (text) => {
    try {
      await chatReady;

      if (typeof text !== "string") {
        throw new Error("Message text is required");
      }

      const routeId = socket.routeId;
      // Lowercase to match the client's senderType === userType.toLowerCase()
      // comparison (src/app/rides/[id]/page.tsx).
      const senderType =
        socket.routeDriver?._id?.toString() === socket.user
          ? "driver"
          : socket.routeStudent?._id?.toString() === socket.user
            ? "student"
            : "admin";

      const message = { senderType, text, time: new Date() };
      const saved = await appendMessage(routeId, message);
      if (!saved) {
        socket.emit("chatError", "This ride's chat has ended");
        return;
      }

      io.to(room).emit("receiveChatMessage", message);
      debugLog(`User ${socket.user} sent a message to room ${room}`);
    } catch (error) {
      console.error(
        `sendChatMessage failed for user ${socket.user} in room ${room}:`,
        error,
      );
      socket.emit("chatError", "Invalid message format");
    }
  });
}
