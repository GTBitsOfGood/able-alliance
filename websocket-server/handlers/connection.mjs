import { debugLog } from "../utils/logger.mjs";
import { getMessages } from "../utils/chatStore.mjs";
import { registerChatHandler } from "./chat.mjs";
import { registerLocationHandler } from "./location.mjs";
import { registerRouteHandler } from "./route.mjs";

export function handleConnection(io, socket) {
  console.log("A user connected", socket.id);

  const room = socket.routeId;
  try {
    socket.join(room);
    debugLog(`User ${socket.user} joined room ${room}`);

    const history = getMessages(room);
    socket.emit("chatHistory", history);
    debugLog(
      `Sent chat history to user ${socket.user} for room ${room} with ${history.length} messages`,
    );
  } catch (error) {
    console.error(
      `Failed to set up connection for user ${socket.user} in room ${room}:`,
      error,
    );
    socket.emit("connectionError", "Failed to join route");
    socket.disconnect(true);
    return;
  }

  registerChatHandler(io, socket, room);
  registerLocationHandler(socket, room);
  registerRouteHandler(io, socket, room);
}
