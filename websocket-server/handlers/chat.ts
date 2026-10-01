import type { AppServer, AppSocket, ChatMessage } from "../types.js";
import { appendMessage } from "../utils/db.js";
import { debugLog } from "../utils/logger.js";
import { notifyDriverMessage } from "../utils/email.js";
import mongoose from "mongoose";

export function registerChatHandler(
  io: AppServer,
  socket: AppSocket,
  room: string,
  chatReady: Promise<void>,
) {
  socket.on("sendChatMessage", async (text) => {
    try {
      await chatReady;

      if (typeof text !== "string") {
        throw new Error("Message text is required");
      }

      const routeId = socket.data.routeId;
      const senderType =
        socket.data.routeDriver?._id?.toString() === socket.data.user
          ? "driver"
          : socket.data.routeStudent?._id?.toString() === socket.data.user
            ? "student"
            : "admin";

      const message: ChatMessage = {
        _id: new mongoose.Types.ObjectId(),
        senderType,
        text,
        time: new Date(),
      };
      const saved = await appendMessage(routeId, message);
      if (!saved) {
        socket.emit("chatError", "This ride's chat has ended");
        return;
      }

      io.to(room).emit("receiveChatMessage", message);
      debugLog(`User ${socket.data.user} sent a message to room ${room}`);
      if (senderType === "driver") {
        void notifyDriverMessage(
          routeId,
          message._id.toString(),
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
      socket.emit("chatError", "Invalid message format");
    }
  });
}
