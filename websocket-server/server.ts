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
import { handleNotificationConnection } from "./handlers/notifications.js";

dotenv.config();

// Paths that should route to websocket-server and not Next.js
const WEBSOCKET_HTTP_PATHS = new Set(["/notify", "/events"]);

export async function startServer(requestHandler?: RequestListener) {
  const PORT = Number(process.env.PORT ?? 4000);

  const app = express();
  app.use(express.json());

  const server = createServer((req, res) => {
    const pathname = req.url?.split("?")[0] ?? "";
    if (requestHandler && !WEBSOCKET_HTTP_PATHS.has(pathname)) {
      requestHandler(req, res);
    } else {
      app(req, res);
    }
  });
  const io = new Server<
    ClientEvents,
    ServerEvents,
    InterServerEvents,
    SocketData
  >(server, {
    cors: {
      origin: new URL(process.env.DEPLOY_PRIME_URL ?? "http://localhost:3000")
        .origin,
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  io.engine.on("connection_error", (error) => {
    console.error("Socket.IO transport connection failed", {
      code: error.code,
      message: error.message,
      context: error.context,
      transport: error.req._query.transport,
      hasSessionId: Boolean(error.req._query.sid),
      method: error.req.method,
      upgrade: error.req.headers.upgrade,
      connection: error.req.headers.connection,
    });
  });

  try {
    await connectDatabase();
    console.log("Websocket server connected to PostgreSQL");

    io.use(authenticateSocket);
    io.on("connection", (socket) => handleConnection(io, socket));

    const notificationsNsp = io.of("/notifications");
    notificationsNsp.use(authenticateNotificationSocket);
    notificationsNsp.on("connection", handleNotificationConnection);

    registerHttpRoutes(app, notificationsNsp);

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
