import type { AppServer, AppSocket } from "../types.js";
import { getRouteStatus, isChatClosed } from "../actions.js";
// Purely a socket.io room operation now — creating and archiving the chat
// record lives in RouteAction.ts (Next.js), tied to the route's actual
// status transitions rather than to a client's socket being connected.
export function registerCloseRouteRoomHandler(
  io: AppServer,
  socket: AppSocket,
  room: string,
) {
  socket.on("closeRouteRoom", async () => {
    try {
      const routeId = socket.data.routeId;

      const route = await getRouteStatus(routeId);
      if (!route || !isChatClosed(route.status)) {
        socket.emit("closeRouteRoomError", "Ride chat is still active");
        return;
      }

      io.to(room).emit("routeClosed");

      const sockets = await io.in(routeId).fetchSockets();
      for (const s of sockets) {
        s.disconnect(true);
      }
      console.log(`Route ${routeId} closed`);
    } catch (error) {
      console.error(
        `closeRouteRoom failed for user ${socket.data.user} in room ${room}:`,
        error,
      );
      socket.emit("closeRouteRoomError", "Failed to close route room");
    }
  });
}
