import type { RouteStatus, UserType } from "@db/generated/enums";

export type ToastType = "success" | "error" | "info" | "warn";

export type ToastPayload = { type: ToastType; message: string };

export type ToastNotification = ToastPayload & { activeType: UserType };

export type RouteUpdate = { routeId: string; status: RouteStatus };

/**
 * What changed since the last call: the IDs of the routes that were updated,
 * or `null` when the page should reload everything (after a (re)connect,
 * since events sent while not connected are lost).
 */
export type RouteChanges = { routeIds: string[] | null };
