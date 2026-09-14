import { z } from "zod";

/**
 * Per-user Google Calendar connection, as stored on the user document.
 *
 * Only `refreshTokenEncrypted` and `calendarId` are load-bearing; the rest exist
 * so the UI can show who is connected and when the last sync happened.
 */
export const googleCalendarConnectionSchema = z.object({
  /** AES-256-GCM ciphertext from server/google/tokenCrypto. Never sent to the client. */
  refreshTokenEncrypted: z.string().optional(),
  calendarId: z.string().min(1).default("primary"),
  connectedAt: z.coerce.date().optional(),
  lastSyncedAt: z.coerce.date().optional(),
  googleEmail: z.string().optional(),
  syncedEventCount: z.number().int().nonnegative().default(0),
});

export type GoogleCalendarConnection = z.infer<
  typeof googleCalendarConnectionSchema
>;

/** The connection as exposed over the API — token stripped. */
export type GoogleCalendarStatus = {
  connected: boolean;
  calendarId: string | null;
  googleEmail: string | null;
  connectedAt: string | null;
  lastSyncedAt: string | null;
  syncedEventCount: number;
};

/** One row of the calendar picker dropdown. */
export type GoogleCalendarOption = {
  id: string;
  summary: string;
  primary: boolean;
  /** Google marks calendars the user can't write to; those can't receive ride events. */
  accessRole: string;
};

/** Outcome of a sync, surfaced to the user so they can see what changed. */
export type CalendarSyncResult = {
  created: number;
  updated: number;
  deleted: number;
  unchanged: number;
  syncedEventCount: number;
  lastSyncedAt: string;
};

/** Body of POST /api/calendar/select. */
export const selectCalendarSchema = z
  .object({
    calendarId: z.string().min(1),
  })
  .strict();
