import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Minimal route shape for auth — only the fields we need.
// Uses raw collection; no Mongoose model/schema.
async function getRouteForAuth(routeId) {
  if (!mongoose.Types.ObjectId.isValid(routeId)) {
    throw new Error("Invalid route ID");
  }
  const routes = mongoose.connection.db.collection("routes");
  const route = await routes.findOne(
    { _id: mongoose.Types.ObjectId.createFromHexString(routeId) },
    { projection: { status: 1, driver: 1, student: 1 } },
  );
  return route;
}

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({ message: "Express server running", ok: true });
});
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

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

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Websocket server connected to MongoDB");

    io.use(async (socket, next) => {
      try {
        const { routeId, userId } = socket.handshake.auth;
        if (!routeId || !userId) {
          return next(new Error("Route ID or user ID missing"));
        }
        const route = await getRouteForAuth(routeId);
        if (!route) {
          return next(new Error("Route not found"));
        }
        if (route.status !== "En-route") {
          return next(new Error("Route is not en-route"));
        }

        const isStudent = route.student?._id?.toString() === userId;

        const isDriver = route.driver?._id?.toString() === userId;

        if (!isStudent && !isDriver) {
          return next(new Error("User not authorized for this route"));
        }

        socket.routeId = routeId;
        socket.user = userId;
        next();
      } catch (error) {
        return next(new Error("Auth error: " + error.message));
      }
    });

    io.on("connection", (socket) => {
      console.log("A user connected", socket.id);

      const room = socket.routeId;
      socket.join(room);
      console.log(`User ${socket.user} joined room ${room}`);

      // Chat
      socket.on("sendChatMessage", async (message) => {
        try {
          if (typeof message !== "string") {
            throw new Error("Message text is required");
          }
          io.to(room).emit("receiveChatMessage", message);
          console.log(
            `User ${socket.user} sent message to room ${room}: ${message}!`,
          );
        } catch (error) {
          console.error("Invalid message format", error);
          socket.emit("chatError", "Invalid message format");
        }
      });

      // Location
      socket.on("updateLocation", async (location) => {
        try {
          if (
            typeof location.latitude !== "number" ||
            typeof location.longitude !== "number"
          ) {
            throw new Error("Coordinates are invalid");
          }
          socket.to(room).emit("broadcastLocation", location);
          console.log(
            `User ${socket.user} updated location in room ${room}: ${JSON.stringify(location)}!`,
          );
        } catch (error) {
          console.error("Failed to update location", error);
          socket.emit("locationError", "Failed to update location");
        }
      });

      socket.on("disconnect", () => {
        console.log("A user disconnected", socket.id);
      });
    });

    // start the server after successful DB connection
    server.listen(PORT, () => {
      console.log(`Websocket server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to MongoDB", error.message);
    process.exit(1);
  }
})();
