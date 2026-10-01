import type {
  ClientEvents,
  ServerEvents,
  InterServerEvents,
  SocketData,
} from "./types.js";
import express from "express";
import dotenv from "dotenv";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { registerHttpRoutes } from "./httpRoutes.js";
import { authenticateSocket, authenticateNotificationSocket } from "./auth.js";
import { handleConnection } from "./handlers/connection.js";

dotenv.config();

export async function startServer() {
  const PORT = Number(process.env.PORT ?? 4000);

  const app = express();
  app.use(express.json());

  const server = createServer(app);
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
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is required");
    await mongoose.connect(uri);
    console.log("Websocket server connected to MongoDB");

    io.use(authenticateSocket);
    io.on("connection", (socket) => handleConnection(io, socket));

    const notificationsNsp = io.of("/notifications");
    notificationsNsp.use(authenticateNotificationSocket);
    notificationsNsp.on("connection", (socket) => {
      socket.join(`user:${socket.data.user}`);
    });

    registerHttpRoutes(app, notificationsNsp);

    server.listen(PORT, () => {
      console.log(`Websocket server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error(
      "Failed to connect to MongoDB",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

void startServer();
