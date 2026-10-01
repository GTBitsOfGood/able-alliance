import type { AppSocket } from "../types.js";
import { debugLog } from "../utils/logger.js";

export function registerLocationHandler(socket: AppSocket, room: string) {
  socket.on("updateLocation", async (location) => {
    try {
      if (
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number"
      ) {
        throw new Error("Coordinates are invalid");
      }
      socket.to(room).emit("broadcastLocation", location);
      debugLog(`User ${socket.data.user} updated location in room ${room}`);
    } catch (error) {
      console.error(
        `updateLocation failed for user ${socket.data.user} in room ${room}:`,
        error,
      );
      socket.emit("locationError", "Failed to update location");
    }
  });
}
