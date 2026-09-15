// Purely a socket.io room operation now — creating and archiving the chat
// record lives in RouteAction.ts (Next.js), tied to the route's actual
// status transitions rather than to a client's socket being connected.
export function registerCloseRouteRoomHandler(io, socket, room) {
  socket.on("closeRouteRoom", async () => {
    try {
      const routeId = socket.routeId;

      io.to(room).emit("routeClosed");

      const sockets = await io.in(routeId).fetchSockets();
      for (const s of sockets) {
        s.disconnect(true);
      }
      console.log(`Route ${routeId} closed`);
    } catch (error) {
      console.error(
        `closeRouteRoom failed for user ${socket.user} in room ${room}:`,
        error,
      );
      socket.emit("closeRouteRoomError", "Failed to close route room");
    }
  });
}
