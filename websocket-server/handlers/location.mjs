import { debugLog } from "../utils/logger.mjs";

export function registerLocationHandler(socket, room) {
  socket.on("updateLocation", async (location) => {
    try {
      if (
        typeof location.latitude !== "number" ||
        typeof location.longitude !== "number"
      ) {
        throw new Error("Coordinates are invalid");
      }
      socket.to(room).emit("broadcastLocation", location);
      debugLog(`User ${socket.user} updated location in room ${room}`);
    } catch (error) {
      console.error(
        `updateLocation failed for user ${socket.user} in room ${room}:`,
        error,
      );
      socket.emit("locationError", "Failed to update location");
    }
  });
}
