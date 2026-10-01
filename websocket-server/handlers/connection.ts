import type { AppServer, AppSocket } from "../types.js";
import { debugLog } from "../utils/logger.js";
import { getChatHistory } from "../utils/db.js";
import { registerChatHandler } from "./chat.js";
import { registerLocationHandler } from "./location.js";
import { registerCloseRouteRoomHandler } from "./closeRouteRoom.js";

export function handleConnection(io: AppServer, socket: AppSocket) {
  console.log("A user connected", socket.id);

  const room = socket.data.routeId;
  try {
    socket.join(room);
    debugLog(`User ${socket.data.user} joined room ${room}`);
  } catch (error) {
    console.error(
      `Failed to set up connection for user ${socket.data.user} in room ${room}:`,
      error,
    );
    socket.emit("connectionError", "Failed to join route");
    socket.disconnect(true);
    return;
  }

  // Handler is registered immediately (below) so a fast client's events
  // can't be dropped while this resolves; the chat handler awaits this
  // promise before touching the chat record. The record itself is created
  // by RouteAction.ts when the ride is scheduled — this only reads it.
  const chatReady = getChatHistory(room)
    .then((history) => {
      socket.emit("chatHistory", history);
      debugLog(
        `Sent chat history to user ${socket.data.user} for room ${room} with ${history.length} messages`,
      );
    })
    .catch((error) => {
      console.error(
        `Failed to load chat history for user ${socket.data.user} in room ${room}:`,
        error,
      );
      socket.emit("connectionError", "Failed to join route");
      socket.disconnect(true);
      throw error;
    });

  registerChatHandler(io, socket, room, chatReady);
  registerLocationHandler(socket, room);
  registerCloseRouteRoomHandler(io, socket, room);
}
