import jwt from "jsonwebtoken";
import { debugLog } from "./utils/logger.mjs";
import { getRouteForAuth } from "./utils/db.mjs";

// Compare dates in America/New_York using Intl (works reliably in Node).
function estDateStr(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Socket.IO middleware: verifies the client's JWT, loads the route, and
// authorizes the connecting user (student/driver/super admin, same-day only).
export async function authenticateSocket(socket, next) {
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
      decoded = jwt.verify(token, secret);
      debugLog("JWT decoded successfully:", decoded);
    } catch (error) {
      console.error("JWT verify failed:", error.message);
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

    socket.routeId = routeId;
    socket.user = userId;
    socket.userType = decoded.type;
    socket.routeStudent = route.student;
    socket.routeDriver = route.driver;
    next();
  } catch (error) {
    console.error(`Auth error for routeId ${routeId}:`, error);
    return next(new Error("Authentication failed"));
  }
}
