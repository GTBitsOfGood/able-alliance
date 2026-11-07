import type { AppServer, AppSocket } from "../types.js";
import { getRouteStatus, isChatClosed } from "../actions.js";
import { debugLog } from "../utils/logger.js";

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

      // The room follows the ride, not the client asking. Without this any
      // connected participant could disconnect everyone mid-ride.
      const route = await getRouteStatus(routeId);
      if (!route) {
        socket.emit("closeRouteRoomError", "Route not found");
        return;
      }
      if (!isChatClosed(route.status)) {
        debugLog(
          `Refused closeRouteRoom for ${routeId} from user ${socket.data.user}: status is ${route.status}`,
        );
        socket.emit(
          "closeRouteRoomError",
          "This ride is still active, so its chat stays open",
        );
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
