import type { AppServer, AppSocket } from "../types.js";
import { appendMessage } from "../actions.js";
import { debugLog } from "../utils/logger.js";
import { notifyDriverMessage } from "../utils/email.js";

export function registerChatHandler(
  io: AppServer,
  socket: AppSocket,
  room: string,
  historyReady: Promise<void>,
) {
  socket.on("sendChatMessage", async (text) => {
    try {
      await historyReady;

      if (typeof text !== "string") {
        throw new Error("Message text is required");
      }

      const routeId = socket.data.routeId;
      const message = await appendMessage(routeId, socket.data.user, text);
      io.to(room).emit("receiveChatMessage", message);
      debugLog(`User ${socket.data.user} sent a message to room ${room}`);
      if (message.senderId === socket.data.routeDriver?.id) {
        void notifyDriverMessage(
          routeId,
          message.id,
          socket.handshake.auth.token,
        ).catch((error) => {
          console.error(
            `Driver-message email failed for route ${routeId}:`,
            error,
          );
        });
      }
    } catch (error) {
      console.error(
        `sendChatMessage failed for user ${socket.data.user} in room ${room}:`,
        error,
      );
      socket.emit("chatError", "Failed to send message");
    }
  });
}
