import type { AppSocket, AuthNext } from "./types.js";
import { debugLog } from "./utils/logger.js";
import {
  AUTH_FAILURE_MESSAGES,
  authorizeRouteSocket,
  checkAccount,
  verifyToken,
} from "./authz.js";

// Socket.IO middleware: verifies the client's JWT, loads the route, and
// authorizes the ride participants and admins. The same checks run again
// periodically from reauthorize.ts, so access that is taken away reaches
// connections that are already open.
export async function authenticateSocket(socket: AppSocket, next: AuthNext) {
  const { routeId, token } = socket.handshake.auth;
  try {
    debugLog(
      `Auth attempt for routeId: ${routeId} and token is ${token ? "present" : "missing"} `,
    );
    if (!routeId || !token) {
      return next(new Error("Route ID or token missing"));
    }

    const result = await authorizeRouteSocket(token, routeId);
    if (!result.ok) {
      debugLog(`Auth rejected for routeId ${routeId}: ${result.reason}`);
      return next(new Error(AUTH_FAILURE_MESSAGES[result.reason]));
    }

    socket.data.routeId = routeId;
    socket.data.user = result.token.userId;
    socket.data.userType = result.token.activeType;
    socket.data.tokenExp = result.token.exp;
    socket.data.routeStudent = result.route?.student ?? undefined;
    socket.data.routeDriver = result.route?.driver ?? null;
    next();
  } catch (error) {
    console.error(`Auth error for routeId ${routeId}:`, error);
    return next(new Error("Authentication failed"));
  }
}

// Socket.IO middleware for the /notifications namespace: verifies the
// client's JWT and admits any authenticated user to their own room —
// unlike authenticateSocket, there's no route scoping here since
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

    const verified = verifyToken(token);
    if (!verified.ok) {
      return next(new Error(AUTH_FAILURE_MESSAGES[verified.reason]));
    }

    const { userId, activeType } = verified.token;
    const failure = await checkAccount(userId, activeType);
    if (failure) {
      return next(new Error(AUTH_FAILURE_MESSAGES[failure]));
    }

    socket.data.user = userId;
    socket.data.userType = activeType;
    socket.data.tokenExp = verified.token.exp;
    next();
  } catch (error) {
    console.error("Notification auth error:", error);
    return next(new Error("Authentication failed"));
  }
}
