import type { AppNamespace, AppSocket } from "./types.js";
import { debugLog } from "./utils/logger.js";
import {
  AUTH_FAILURE_MESSAGES,
  checkAccount,
  checkRouteAccess,
  verifyToken,
  type AuthFailure,
} from "./authz.js";

/** How often open connections are re-checked against current permissions. */
const SWEEP_INTERVAL_MS = 30_000;

/**
 * Drops a socket whose access no longer holds, telling the client why first
 * so it can show something better than a silent disconnect.
 */
export function revokeSocket(socket: AppSocket, reason: AuthFailure) {
  debugLog(
    `Revoking socket ${socket.id} for user ${socket.data.user}: ${reason}`,
  );
  socket.emit("accessRevoked", {
    reason,
    message: AUTH_FAILURE_MESSAGES[reason],
  });
  socket.disconnect(true);
}

/** Re-runs the connect-time checks for one socket. Null means still allowed. */
async function recheck(socket: AppSocket): Promise<AuthFailure | null> {
  const verified = verifyToken(socket.handshake.auth?.token);
  if (!verified.ok) return verified.reason;

  const { userId, activeType } = verified.token;
  const accountFailure = await checkAccount(userId, activeType);
  if (accountFailure) return accountFailure;

  // Notification sockets are not scoped to a ride, so there is nothing more
  // to check once the account and token are known good.
  if (!socket.data.routeId) return null;

  return checkRouteAccess(userId, activeType, socket.data.routeId);
}

async function sweep(namespaces: AppNamespace[]) {
  for (const namespace of namespaces) {
    const sockets = [...namespace.sockets.values()] as AppSocket[];
    for (const socket of sockets) {
      try {
        const failure = await recheck(socket);
        if (failure) revokeSocket(socket, failure);
      } catch (error) {
        // A transient database error must not disconnect a legitimate user,
        // so the socket is left alone and re-checked on the next sweep.
        console.error(`Re-authorization check failed for ${socket.id}:`, error);
      }
    }
  }
}

/**
 * Starts the periodic re-check and returns a stop function.
 *
 * The sweep is the backstop. Two things make revocation faster than the
 * interval: a per-socket timer fires the moment the token expires, and
 * `/revoke` lets the Next.js app drop sockets the instant access changes.
 */
export function startReauthorizationSweep(namespaces: AppNamespace[]) {
  const timer = setInterval(() => {
    void sweep(namespaces);
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return () => clearInterval(timer);
}

/**
 * Disconnects a socket exactly when its token expires, rather than waiting
 * for the next sweep. Tokens without an `exp` claim are left to the sweep.
 */
export function scheduleTokenExpiry(socket: AppSocket) {
  const exp = socket.data.tokenExp;
  if (typeof exp !== "number") return;

  const msUntilExpiry = exp * 1000 - Date.now();
  if (msUntilExpiry <= 0) {
    revokeSocket(socket, "token-expired");
    return;
  }

  // setTimeout saturates above ~24.8 days; the sweep covers anything longer.
  const MAX_TIMEOUT = 2_147_483_647;
  if (msUntilExpiry > MAX_TIMEOUT) return;

  const timer = setTimeout(
    () => revokeSocket(socket, "token-expired"),
    msUntilExpiry,
  );
  timer.unref?.();
  socket.on("disconnect", () => clearTimeout(timer));
}

/**
 * Immediate revocation, driven by the Next.js app when access changes.
 * Matches on user, on route, or on both, and re-checks each candidate so a
 * socket that is still legitimately allowed survives.
 */
export async function revokeMatchingSockets(
  namespaces: AppNamespace[],
  filter: { userId?: string; routeId?: string },
): Promise<number> {
  let revoked = 0;
  for (const namespace of namespaces) {
    const sockets = [...namespace.sockets.values()] as AppSocket[];
    for (const socket of sockets) {
      if (filter.userId && socket.data.user !== filter.userId) continue;
      if (filter.routeId && socket.data.routeId !== filter.routeId) continue;
      try {
        const failure = await recheck(socket);
        if (failure) {
          revokeSocket(socket, failure);
          revoked += 1;
        }
      } catch (error) {
        console.error(`Revocation check failed for ${socket.id}:`, error);
      }
    }
  }
  return revoked;
}
