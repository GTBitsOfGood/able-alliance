import type {
  ClientEvents,
  ServerEvents,
  InterServerEvents,
  SocketData,
} from "./types.js";
import express from "express";
import dotenv from "dotenv";
import { createServer, type RequestListener } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Server } from "socket.io";
import { connectDatabase } from "./actions.js";
import { registerHttpRoutes } from "./httpRoutes.js";
import { authenticateSocket, authenticateNotificationSocket } from "./auth.js";
import { handleConnection } from "./handlers/connection.js";

dotenv.config();

export async function startServer(requestHandler?: RequestListener) {
  const PORT = Number(process.env.PORT ?? 4000);

  const app = express();
  app.use(express.json());

  const server = createServer(requestHandler ?? app);
  const io = new Server<
    ClientEvents,
    ServerEvents,
    InterServerEvents,
    SocketData
  >(server, {
    cors: {
      origin: [
        "http://localhost:3000",
        "https://able-alliance.netlify.app",
        /^https:\/\/deploy-preview-\d+--able-alliance\.netlify\.app$/, // deploy previews
      ],
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  try {
    await connectDatabase();
    console.log("Websocket server connected to PostgreSQL");

    io.use(authenticateSocket);
    io.on("connection", (socket) => handleConnection(io, socket));

    const notificationsNsp = io.of("/notifications");
    notificationsNsp.use(authenticateNotificationSocket);
    notificationsNsp.on("connection", (socket) => {
      socket.join(`user:${socket.data.user}`);
      if (
        socket.data.userType === "Admin" ||
        socket.data.userType === "SuperAdmin"
      ) {
        socket.join("role:admin");
      }
    });

    registerHttpRoutes(app, notificationsNsp);

    if (requestHandler) {
      // Keep notification HTTP routes on a private loopback listener. Socket.IO
      // and Next.js share the public server and its Platform-assigned port.
      const internalServer = createServer(app);
      await new Promise<void>((resolve, reject) => {
        internalServer.once("error", reject);
        internalServer.listen(0, "127.0.0.1", () => {
          internalServer.off("error", reject);
          resolve();
        });
      });
      const address = internalServer.address();
      if (address && typeof address !== "string") {
        process.env.WEBSOCKET_INTERNAL_URL = `http://127.0.0.1:${address.port}`;
      }
      server.once("close", () => internalServer.close());
    }

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(PORT, "0.0.0.0", () => {
        server.off("error", reject);
        resolve();
      });
    });
    console.log(`Websocket server listening on port ${PORT}`);
    return server;
  } catch (error) {
    console.error(
      "Failed to connect to PostgreSQL",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void startServer();
}
