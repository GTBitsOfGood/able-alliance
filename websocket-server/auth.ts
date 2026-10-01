import type { AppSocket, AuthNext } from "./types.js";
import jwt from "jsonwebtoken";
import { debugLog } from "./utils/logger.js";
import { getRouteForAuth } from "./utils/db.js";

// Compare dates in America/New_York using Intl (works reliably in Node).
function estDateStr(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Socket.IO middleware: verifies the client's JWT, loads the route, and
// authorizes the connecting user (student/driver/super admin, same-day only).
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
        typeof payload.type !== "string"
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

    const userId = decoded.userId;
    debugLog("User ID from token:", userId);

    const route = await getRouteForAuth(routeId);
    if (!route) {
      return next(new Error("Route not found"));
    }

    const routeDateStr = estDateStr(new Date(route.scheduledPickupTime));
    const todayStr = estDateStr(new Date());
    const isSameDay = routeDateStr === todayStr;
    debugLog(
      `Date check: route=${routeDateStr}, today=${todayStr}, same=${isSameDay}`,
    );
    if (!isSameDay) {
      return next(new Error("Route is not scheduled for today"));
    }

    const isStudent = route.student?._id?.toString() === userId;
    const isDriver = route.driver?._id?.toString() === userId;
    const isSuperAdmin = decoded.type === "SuperAdmin";

    if (!isStudent && !isDriver && !isSuperAdmin) {
      return next(new Error("User not authorized for this route"));
    }

    socket.data.routeId = routeId;
    socket.data.user = userId;
    socket.data.userType = decoded.type;
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
        typeof payload.type !== "string"
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

    socket.data.user = decoded.userId;
    next();
  } catch (error) {
    console.error("Notification auth error:", error);
    return next(new Error("Authentication failed"));
  }
}
