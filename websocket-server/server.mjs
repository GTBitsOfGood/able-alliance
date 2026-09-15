import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { registerHttpRoutes } from "./httpRoutes.mjs";
import { authenticateSocket } from "./auth.mjs";
import { handleConnection } from "./handlers/connection.mjs";

export async function startServer() {
  const PORT = process.env.PORT ?? 4000;

  const app = express();
  app.use(express.json());
  registerHttpRoutes(app);

  const server = createServer(app);
  const io = new Server(server, {
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
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Websocket server connected to MongoDB");

    io.use(authenticateSocket);
    io.on("connection", (socket) => handleConnection(io, socket));

    server.listen(PORT, () => {
      console.log(`Websocket server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB", error.message);
    process.exit(1);
  }
}
