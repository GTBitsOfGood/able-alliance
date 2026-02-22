import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";

import RouteModel from "../src/server/db/models/RouteModel.ts";

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

await mongoose.connect(process.env.MONGODB_URI);
console.log("Connected to MongoDB");

io.use(async (socket, next) => {
  try {
    const {routeId, userId} = socket.handshake.auth;
    if (!routeId || !userId) {
      return next(new Error("Route ID or user ID missing"));
    }
    const route = await RouteModel.findById(routeId);
    if (!route) {
      return next(new Error("Route not found"));
    }
    if (route.status !== "En-route") {
      return next(new Error("Route is not en-route"));
    }
    const userInRoute =
      route.driver?.toString() === userId ||
      route.students?.some(id => id.toString() === userId);

    if (!userInRoute) {
      return next(new Error("User not assigned to this route"));
    }
    socket.route = route;
    socket.user = userId;
    next();
  } catch (error) {
      return next(new Error("Auth error: " + error.message));
  }
});


io.on("connection", socket => {
  console.log("A user connected", socket.id);

  const room = socket.route.id;
  socket.join(room);
  console.log(`User ${socket.user} joined room ${room}`);

  // Chat
  socket.on("sendChatMessage", async (message) => {
    try {
      if (typeof message !== "string") {
        throw new Error("Message text is required");
      }
      io.to(room).emit("receiveChatMessage", message);
    } catch (error) {
      console.error("Invalid message format", error);
      socket.emit("chatError", "Invalid message format");
    }
  });
  
  // Location
  socket.on("updateLocation", async (location) => {
    try {
      if (typeof location.latitude !== "number" || typeof location.longitude !== "number") {
        throw new Error("Coordinates are invalid");
      }
      io.to(room).emit("broadcastLocation", location);
    } catch (error) {
      console.error("Failed to update location", error);
      socket.emit("locationError", "Failed to update location");
    }
  });

});



// Routes
app.get("/", (req, res) => {
  res.json({ message: "Express server running", ok: true });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});


// Start server
server.listen(PORT, () => {
  console.log(`Express server listening on port ${PORT}`);
});
