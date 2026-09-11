import { debugLog } from "../utils/logger.mjs";
import { ensureActiveChatlog, getChatHistory } from "../utils/db.mjs";
import { registerChatHandler } from "./chat.mjs";
import { registerLocationHandler } from "./location.mjs";
import { registerRouteHandler } from "./route.mjs";

export function handleConnection(io, socket) {
  console.log("A user connected", socket.id);

  const room = socket.routeId;
  try {
    socket.join(room);
    debugLog(`User ${socket.user} joined room ${room}`);
  } catch (error) {
    console.error(
      `Failed to set up connection for user ${socket.user} in room ${room}:`,
      error,
    );
    socket.emit("connectionError", "Failed to join route");
    socket.disconnect(true);
    return;
  }

  // Handlers are registered immediately (below) so a fast client's events
  // can't be dropped while this resolves; chat/route handlers await this
  // promise before touching the chat record.
  const chatReady = ensureActiveChatlog(
    room,
    socket.routeStudent,
    socket.routeDriver,
  )
    .then(() => getChatHistory(room))
    .then((history) => {
      socket.emit("chatHistory", history);
      debugLog(
        `Sent chat history to user ${socket.user} for room ${room} with ${history.length} messages`,
      );
    })
    .catch((error) => {
      console.error(
        `Failed to load chat history for user ${socket.user} in room ${room}:`,
        error,
      );
      socket.emit("connectionError", "Failed to join route");
      socket.disconnect(true);
      throw error;
    });

  registerChatHandler(io, socket, room, chatReady);
  registerLocationHandler(socket, room);
  registerRouteHandler(io, socket, room, chatReady);
}
