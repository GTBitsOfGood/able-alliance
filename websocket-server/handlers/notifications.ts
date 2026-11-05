import type { AppSocket } from "../types.js";

export function handleNotificationConnection(socket: AppSocket) {
  // Data updates still use the user's room; toasts target the active role.
  socket.join(`user:${socket.data.user}`);
  socket.join(`user:${socket.data.user}:role:${socket.data.userType}`);
  if (
    socket.data.userType === "Admin" ||
    socket.data.userType === "SuperAdmin"
  ) {
    socket.join("role:admin");
  }
}
