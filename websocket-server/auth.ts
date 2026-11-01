import { db } from "@db";
import type { AppSocket, AuthNext } from "./types.js";
import jwt from "jsonwebtoken";
import { debugLog } from "./utils/logger.js";
import { getRouteForAuth } from "./actions.js";

// Socket.IO middleware: verifies the client's JWT, loads the route, and
// authorizes the ride participants and admins for the lifetime of the chat.
export async function authenticateSocket(socket: AppSocket, next: AuthNext) {
  const { routeId, token } = socket.handshake.auth;
  try {
    debugLog(
      `Auth attempt for routeId: ${routeId} and token is ${token ? "present" : "missing"} `,
    );
    if (!routeId || !token) {
      return next(new Error("Route ID or token missing"));
    }

    let decoded;
    try {
      const secret = process.env.NEXTAUTH_SECRET;
      if (!secret) throw new Error("NEXTAUTH_SECRET is required");
      const payload = jwt.verify(token, secret);
      if (
        typeof payload === "string" ||
        typeof payload.userId !== "string" ||
        typeof payload.activeType !== "string"
      ) {
        throw new Error("Invalid JWT payload");
      }
      decoded = payload;
      debugLog("JWT decoded successfully:", decoded);
    } catch (error) {
      console.error(
        "JWT verify failed:",
        error instanceof Error ? error.message : error,
      );
      return next(new Error("Invalid JWT token"));
    }

    const account = await db.user.findUnique({ where: { id: decoded.userId } });
    if (
      !account ||
      account.status !== "active" ||
      !account.types.some((role) => role === decoded.activeType)
    ) {
      return next(new Error("Role is no longer assigned"));
    }
    const userId = decoded.userId;
    debugLog("User ID from token:", userId);

    const route = await getRouteForAuth(routeId);
    if (!route) {
      return next(new Error("Route not found"));
    }

    const isStudent =
      decoded.activeType === "Student" && route.student?.id === userId;
    const isDriver =
      decoded.activeType === "Driver" && route.driver?.id === userId;
    const isAdmin = decoded.activeType === "Admin";
    const isSuperAdmin = decoded.activeType === "SuperAdmin";

    if (!isStudent && !isDriver && !isSuperAdmin && !isAdmin) {
      return next(new Error("User not authorized for this route"));
    }

    socket.data.routeId = routeId;
    socket.data.user = userId;
    socket.data.userType = decoded.activeType;
    socket.data.routeStudent = route.student;
    socket.data.routeDriver = route.driver;
    next();
  } catch (error) {
    console.error(`Auth error for routeId ${routeId}:`, error);
    return next(new Error("Authentication failed"));
  }
}

// Socket.IO middleware for the /notifications namespace: verifies the
// client's JWT and admits any authenticated user to their own room —
// unlike authenticateSocket, there's no route/day scoping here since
// notifications are a personal inbox, not tied to a single route.
export async function authenticateNotificationSocket(
  socket: AppSocket,
  next: AuthNext,
) {
  const { token } = socket.handshake.auth;
  try {
    if (!token) {
      return next(new Error("Token missing"));
    }

    let decoded;
    try {
      const secret = process.env.NEXTAUTH_SECRET;
      if (!secret) throw new Error("NEXTAUTH_SECRET is required");
      const payload = jwt.verify(token, secret);
      if (
        typeof payload === "string" ||
        typeof payload.userId !== "string" ||
        typeof payload.activeType !== "string"
      ) {
        throw new Error("Invalid JWT payload");
      }
      decoded = payload;
    } catch (error) {
      console.error(
        "JWT verify failed:",
        error instanceof Error ? error.message : error,
      );
      return next(new Error("Invalid JWT token"));
    }

    if (!decoded.userId) {
      return next(new Error("Token missing userId"));
    }

    const account = await db.user.findUnique({ where: { id: decoded.userId } });
    if (
      !account ||
      account.status !== "active" ||
      !account.types.some((role) => role === decoded.activeType)
    ) {
      return next(new Error("Role is no longer assigned"));
    }
    socket.data.user = decoded.userId;
    socket.data.userType = decoded.activeType;
    next();
  } catch (error) {
    console.error("Notification auth error:", error);
    return next(new Error("Authentication failed"));
  }
}
