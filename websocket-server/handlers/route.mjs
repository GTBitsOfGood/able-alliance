import { getRouteForAuth, archiveChatlog } from "../utils/db.mjs";

export function registerRouteHandler(io, socket, room, chatReady) {
  socket.on("endRoute", async () => {
    try {
      await chatReady;

      const routeId = socket.routeId;
      const route = await getRouteForAuth(routeId);
      const isStudent = route.student?._id?.toString() === socket.user;
      const isDriver = route.driver?._id?.toString() === socket.user;
      const isSuperAdmin = socket.userType === "SuperAdmin";
      if (!isStudent && !isDriver && !isSuperAdmin) {
        throw new Error(
          "Only the route's student, driver, or super admin can end the route",
        );
      }

      await archiveChatlog(routeId);
      console.log(`Chat log archived for route ${routeId}`);

      io.to(room).emit("routeClosed");

      const sockets = await io.in(routeId).fetchSockets();
      for (const s of sockets) {
        s.disconnect(true);
      }
      console.log(`Route ${routeId} closed`);
    } catch (error) {
      console.error(
        `endRoute failed for user ${socket.user} in room ${room}:`,
        error,
      );
      socket.emit("endRouteError", "Failed to end route");
    }
  });
}
