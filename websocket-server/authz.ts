import { db } from "@db";
import jwt from "jsonwebtoken";
import { getRouteForAuth } from "./actions.js";

/**
 * Authorization for a live socket.
 *
 * Connect-time checks and the periodic re-check share this module, so a
 * connection that stays open is held to the same rules as a new one: the
 * token must still be valid and unexpired, the account must still be active
 * with the role it connected under, and — for a route socket — the user must
 * still be a participant in that ride.
 */

export type AuthFailure =
  | "token-invalid"
  | "token-expired"
  | "account-inactive"
  | "role-removed"
  | "route-missing"
  | "not-a-participant";

export type VerifiedToken = {
  userId: string;
  activeType: string;
  /** Token expiry in epoch seconds, when the token carries one. */
  exp?: number;
};

export function verifyToken(
  token: unknown,
): { ok: true; token: VerifiedToken } | { ok: false; reason: AuthFailure } {
  if (typeof token !== "string" || !token) {
    return { ok: false, reason: "token-invalid" };
  }
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required");
  try {
    const payload = jwt.verify(token, secret);
    if (
      typeof payload === "string" ||
      typeof payload.userId !== "string" ||
      typeof payload.activeType !== "string"
    ) {
      return { ok: false, reason: "token-invalid" };
    }
    return {
      ok: true,
      token: {
        userId: payload.userId,
        activeType: payload.activeType,
        exp: typeof payload.exp === "number" ? payload.exp : undefined,
      },
    };
  } catch (error) {
    const expired =
      error instanceof Error && error.name === "TokenExpiredError";
    return { ok: false, reason: expired ? "token-expired" : "token-invalid" };
  }
}

/** The account must still exist, be active, and still hold the role in use. */
export async function checkAccount(
  userId: string,
  activeType: string,
): Promise<AuthFailure | null> {
  const account = await db.user.findUnique({
    where: { id: userId },
    select: { status: true, types: true },
  });
  if (!account || account.status !== "active") return "account-inactive";
  if (!account.types.some((role) => role === activeType)) return "role-removed";
  return null;
}

/**
 * Participants are the ride's student and its currently assigned driver.
 * Admins see every ride. Reassigning a ride therefore drops the old driver
 * the next time this runs.
 */
export async function checkRouteAccess(
  userId: string,
  activeType: string,
  routeId: string,
): Promise<AuthFailure | null> {
  const route = await getRouteForAuth(routeId);
  if (!route) return "route-missing";

  const isStudent = activeType === "Student" && route.student?.id === userId;
  const isDriver = activeType === "Driver" && route.driver?.id === userId;
  const isAdmin = activeType === "Admin" || activeType === "SuperAdmin";

  return isStudent || isDriver || isAdmin ? null : "not-a-participant";
}

/** Every check a route socket must pass, at connect time and afterwards. */
export async function authorizeRouteSocket(
  token: unknown,
  routeId: string,
): Promise<
  | {
      ok: true;
      token: VerifiedToken;
      route: Awaited<ReturnType<typeof getRouteForAuth>>;
    }
  | { ok: false; reason: AuthFailure }
> {
  const verified = verifyToken(token);
  if (!verified.ok) return verified;

  const { userId, activeType } = verified.token;
  const accountFailure = await checkAccount(userId, activeType);
  if (accountFailure) return { ok: false, reason: accountFailure };

  const route = await getRouteForAuth(routeId);
  if (!route) return { ok: false, reason: "route-missing" };

  const routeFailure = await checkRouteAccess(userId, activeType, routeId);
  if (routeFailure) return { ok: false, reason: routeFailure };

  return { ok: true, token: verified.token, route };
}

export const AUTH_FAILURE_MESSAGES: Record<AuthFailure, string> = {
  "token-invalid": "Invalid JWT token",
  "token-expired": "Session expired",
  "account-inactive": "Account is no longer active",
  "role-removed": "Role is no longer assigned",
  "route-missing": "Route not found",
  "not-a-participant": "User not authorized for this route",
};
