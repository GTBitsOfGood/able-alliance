import { getRouteForAuth } from "../utils/db.mjs";
import { addMessage } from "../utils/chatStore.mjs";
import { debugLog } from "../utils/logger.mjs";

export function registerChatHandler(io, socket, room) {
  socket.on("sendChatMessage", async (text) => {
    try {
      if (typeof text !== "string") {
        throw new Error("Message text is required");
      }

      const routeId = socket.routeId;
      const route = await getRouteForAuth(routeId);
      const senderType =
        route.driver?._id?.toString() === socket.user
          ? "driver"
          : route.student?._id?.toString() === socket.user
            ? "student"
            : "admin";

      const message = { senderType, text, time: new Date() };
      addMessage(routeId, message);

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
