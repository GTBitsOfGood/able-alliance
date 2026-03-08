import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";

import RouteModel from "../server/dist/server/db/models/RouteModel.js";dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(express.json());

const server = createServer(app);

const io = new Server(server, {
  cors: {
    // origin: [
    //   "http://localhost:3000",                   
    //   "https://able-alliance.netlify.app",       
    //   /^https:\/\/deploy-preview-\d+--able-alliance\.netlify\.app$/ // deploy previews
    // ],
    origin: "*",
    methods: ["GET", "POST"],
  },
  'transports': ['websocket', 'polling']
});

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");
    server.listen(PORT, () => {
      console.log(`Express server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB", error.message);
    process.exit(1);
  }
})();

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

    const isStudent = route.student._id?.toString() === userId;

    const isDriver =
      route.driver?._id?.toString() === userId;

    if (!isStudent && !isDriver) {
      return next(new Error("User not authorized for this route"));
    }
    
    const userInRoute =
      route.driver?.toString() === userId ||
      route.student.toString() === userId;

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

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
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
// server.listen(PORT, () => {
//   console.log(`Express server listening on port ${PORT}`);
// });
