import { getRouteForAuth, saveChatLog } from "../utils/db.mjs";
import { getMessages, clearMessages } from "../utils/chatStore.mjs";

export function registerRouteHandler(io, socket, room) {
  socket.on("endRoute", async () => {
    try {
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

      const messages = getMessages(routeId);
      await saveChatLog({
        routeId,
        student: route.student,
        driver: route.driver,
        messages,
      });
      console.log(`Chat log saved for route ${routeId}`);

      clearMessages(routeId);
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
