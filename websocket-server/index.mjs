import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const chatStore = new Map(); // Map<routeId, messages[]>

// Minimal route shape for auth — only the fields we need.
// Uses raw collection; no Mongoose model/schema.
async function getRouteForAuth(routeId) {
  if (!mongoose.Types.ObjectId.isValid(routeId)) {
    throw new Error("Invalid route ID");
  }
  const routes = mongoose.connection.db.collection("routes");
  const route = await routes.findOne(
    { _id: mongoose.Types.ObjectId.createFromHexString(routeId) },
    {
      projection: { status: 1, driver: 1, student: 1, scheduledPickupTime: 1 },
    },
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
        const { routeId, token } = socket.handshake.auth;
        console.log(
          `Auth attempt for routeId: ${routeId} and token is ${token ? "present" : "missing"} `,
        );
        if (!routeId || !token) {
          return next(new Error("Route ID or token missing"));
        }
        let decoded;
        try {
          const secret = process.env.NEXTAUTH_SECRET;
          console.log(
            "NEXTAUTH_SECRET present:",
            !!secret,
            "length:",
            secret?.length,
          );
          decoded = jwt.verify(token, secret);
          console.log("JWT decoded successfully:", decoded);
        } catch (error) {
          console.error("JWT verify failed:", error.message);
          return next(new Error("Invalid JWT token"));
        }

        const userId = decoded.userId;

        console.log("User ID from token:", userId);

        const route = await getRouteForAuth(routeId);
        if (!route) {
          return next(new Error("Route not found"));
        }
        const allowedStatuses = ["Scheduled", "En-route"];
        if (!allowedStatuses.includes(route.status)) {
          return next(new Error("Route is not available for communication"));
        }

        const routeDate = new Date(route.scheduledPickupTime);
        const today = new Date();
        const isSameDay =
          routeDate.getFullYear() === today.getFullYear() &&
          routeDate.getMonth() === today.getMonth() &&
          routeDate.getDate() === today.getDate();
        if (!isSameDay) {
          return next(new Error("Route is not scheduled for today"));
        }

        const isStudent = route.student?._id?.toString() === userId;
        const isDriver = route.driver?._id?.toString() === userId;
        const isSuperAdmin = decoded.type === "SuperAdmin";

        if (!isStudent && !isDriver && !isSuperAdmin) {
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

      const history = chatStore.get(room) || [];
      socket.emit("chatHistory", history);
      console.log(
        `Sent chat history to user ${socket.user} for room ${room} with ${history.length} messages`,
      );

      // Chat
      socket.on("sendChatMessage", async (text) => {
        try {
          if (typeof text !== "string") {
            throw new Error("Message text is required");
          }

          const routeId = socket.routeId;
          const route = await getRouteForAuth(routeId);
          const senderType =
            route.driver?._id?.toString() === socket.user
              ? "driver"
              : "student";

          const message = { senderType, text, time: new Date() };

          if (!chatStore.has(routeId)) {
            chatStore.set(routeId, []);
          }

          chatStore.get(routeId).push(message);

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

      socket.on("endRoute", async () => {
        try {
          const routeId = socket.routeId;
          const route = await getRouteForAuth(routeId);
          const isDriver = route.driver?._id?.toString() === socket.user;
          const isSuperAdmin = socket.user === "69d8392ed589ac8dd451ce65";
          if (!isDriver && !isSuperAdmin) {
            throw new Error("Only the driver or super admin can end the route");
          }

          const messages = chatStore.get(routeId) || [];
          const chatlogs = mongoose.connection.db.collection("chatlogs");
          await chatlogs.insertOne({
            routeId: mongoose.Types.ObjectId.createFromHexString(routeId),
            student: route.student,
            driver: route.driver,
            time: new Date(),
            messages,
          });
          console.log(`Chat log saved for route ${routeId}`);
          console.log("Chat log content:" + JSON.stringify(messages)); //TESTING

          chatStore.delete(routeId);
          io.to(room).emit("routeClosed");

          const sockets = await io.in(routeId).fetchSockets();
          for (const s of sockets) {
            s.disconnect(true);
          }
          console.log(`Route ${routeId} closed`);
        } catch (error) {
          console.error("Failed to end route", error);
          socket.emit("endRouteError", "Failed to end route");
        }
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
