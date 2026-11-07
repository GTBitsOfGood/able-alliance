import type { AppServer, AppSocket, SendChatAck } from "../types.js";
import { appendMessage } from "../actions.js";
import { debugLog } from "../utils/logger.js";
import { notifyDriverMessage } from "../utils/email.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Accepts the legacy bare-string payload as well as the current
 * `{ text, clientId }` form, so an older tab mid-session keeps working.
 */
function parsePayload(
  payload: unknown,
): { text: string; clientId?: string } | null {
  if (typeof payload === "string") {
    return payload.trim() ? { text: payload } : null;
  }
  if (payload && typeof payload === "object") {
    const { text, clientId } = payload as Record<string, unknown>;
    if (typeof text !== "string" || !text.trim()) return null;
    if (clientId !== undefined) {
      if (typeof clientId !== "string" || !UUID_PATTERN.test(clientId))
        return null;
      return { text, clientId };
    }
    return { text };
  }
  return null;
}

export function registerChatHandler(
  io: AppServer,
  socket: AppSocket,
  room: string,
  historyReady: Promise<void>,
) {
  socket.on("sendChatMessage", async (payload, ack) => {
    // Nothing below may throw past this point: the sender is waiting on the
    // acknowledgement to decide whether to clear its draft.
    const respond = (result: SendChatAck) => {
      if (typeof ack === "function") ack(result);
    };

    try {
      await historyReady;

      const parsed = parsePayload(payload);
      if (!parsed) {
        respond({
          status: "error",
          error: "Message text is required",
          retryable: false,
        });
        return;
      }

      const routeId = socket.data.routeId;
      const message = await appendMessage(
        routeId,
        socket.data.user,
        parsed.text,
        parsed.clientId,
      );

      io.to(room).emit("receiveChatMessage", message);
      respond({ status: "ok", message });
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
      const chatClosed =
        error instanceof Error &&
        error.message === "Chat is closed for this route";
      if (chatClosed) io.to(room).emit("routeClosed");

      console.error(
        `sendChatMessage failed for user ${socket.data.user} in room ${room}:`,
        error,
      );
      // A closed chat will never accept this message; anything else is
      // most likely transient, so the client may offer a retry.
      respond({
        status: "error",
        error: chatClosed
          ? "Chat is closed for this ride"
          : "Failed to send message",
        retryable: !chatClosed,
      });
      socket.emit("chatError", "Failed to send message");
    }
  });
}
