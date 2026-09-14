/**
 * DB layer for the per-user Google Calendar connection.
 *
 * `googleCalendar.refreshTokenEncrypted` is `select: false` on the schema, so it
 * never rides along on ordinary user reads (e.g. GET /api/users/:id). This module
 * is the only place that opts back in, via `.select("+...")`.
 */

import connectMongoDB from "../mongodb";
import UserModel from "../models/UserModel";
import { UserNotFoundException } from "@/utils/exceptions/user";
import type { GoogleCalendarConnection } from "@/utils/types/googleCalendar";

/** The connection minus the secret — safe to hand to a route handler. */
export type SafeConnection = Omit<
  GoogleCalendarConnection,
  "refreshTokenEncrypted"
> & { connected: boolean };

export async function getConnection(
  userId: string,
): Promise<SafeConnection | null> {
  await connectMongoDB();

  const user = await UserModel.findById(userId).lean();
  if (!user) {
    throw new UserNotFoundException();
  }

  const connection = user.googleCalendar;
  if (!connection) {
    return null;
  }

  return {
    connected: true,
    calendarId: connection.calendarId ?? "primary",
    connectedAt: connection.connectedAt,
    lastSyncedAt: connection.lastSyncedAt,
    googleEmail: connection.googleEmail,
    syncedEventCount: connection.syncedEventCount ?? 0,
  };
}

/**
 * Read the encrypted refresh token. Returns null when the user has no connection
 * — callers turn that into a "not connected" error rather than a crash.
 */
export async function getRefreshToken(userId: string): Promise<string | null> {
  await connectMongoDB();

  const user = await UserModel.findById(userId)
    .select("+googleCalendar.refreshTokenEncrypted")
    .lean();

  return user?.googleCalendar?.refreshTokenEncrypted ?? null;
}

/**
 * Persist a freshly authorized connection.
 *
 * Preserves the previously chosen `calendarId` across a reconnect so a user who
 * disconnects and reconnects doesn't silently get bumped back to "primary".
 */
export async function saveConnection(
  userId: string,
  data: {
    refreshTokenEncrypted: string;
    googleEmail?: string;
    calendarId?: string;
  },
): Promise<void> {
  await connectMongoDB();

  const result = await UserModel.findByIdAndUpdate(
    userId,
    {
      $set: {
        "googleCalendar.refreshTokenEncrypted": data.refreshTokenEncrypted,
        "googleCalendar.calendarId": data.calendarId ?? "primary",
        "googleCalendar.googleEmail": data.googleEmail,
        "googleCalendar.connectedAt": new Date(),
        "googleCalendar.lastSyncedAt": null,
        "googleCalendar.syncedEventCount": 0,
      },
    },
    { new: true },
  ).lean();

  if (!result) {
    throw new UserNotFoundException();
  }
}

/**
 * Point the connection at a different calendar.
 *
 * Resets the sync bookkeeping because the event count refers to the *old*
 * calendar and would otherwise be misleading until the next sync.
 */
export async function setCalendarId(
  userId: string,
  calendarId: string,
): Promise<void> {
  await connectMongoDB();

  const result = await UserModel.findOneAndUpdate(
    { _id: userId, googleCalendar: { $exists: true } },
    {
      $set: {
        "googleCalendar.calendarId": calendarId,
        "googleCalendar.lastSyncedAt": null,
        "googleCalendar.syncedEventCount": 0,
      },
    },
    { new: true },
  ).lean();

  if (!result) {
    throw new UserNotFoundException(
      "User not found or Google Calendar not connected",
    );
  }
}

export async function markSynced(
  userId: string,
  syncedEventCount: number,
): Promise<Date> {
  await connectMongoDB();

  const lastSyncedAt = new Date();
  await UserModel.findByIdAndUpdate(userId, {
    $set: {
      "googleCalendar.lastSyncedAt": lastSyncedAt,
      "googleCalendar.syncedEventCount": syncedEventCount,
    },
  });

  return lastSyncedAt;
}

/** Remove the connection entirely (disconnect, or access revoked at Google). */
export async function clearConnection(userId: string): Promise<void> {
  await connectMongoDB();

  await UserModel.findByIdAndUpdate(userId, {
    $unset: { googleCalendar: "" },
  });
}
