"use client";

/**
 * Placeholder UI for Google Calendar sync. Intentionally unstyled — this exists to
 * exercise the backend end to end and will be replaced once the design is final.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import BogButton from "@/components/BogButton/BogButton";
import type {
  CalendarSyncResult,
  GoogleCalendarOption,
  GoogleCalendarStatus,
} from "@/utils/types/googleCalendar";

/** Human-readable text for the ?error= codes the OAuth callback can redirect with. */
const OAUTH_ERRORS: Record<string, string> = {
  access_denied: "You cancelled the Google sign-in.",
  invalid_state: "Sign-in expired or was tampered with. Please try again.",
  missing_code: "Google did not return an authorization code.",
  no_refresh_token:
    "Google did not return a refresh token. Revoke the app at myaccount.google.com/permissions and try again.",
  exchange_failed: "Could not complete Google sign-in. Please try again.",
};

function formatTimestamp(iso: string | null): string {
  if (!iso) {
    return "Never";
  }
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function CalendarView() {
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendarOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<CalendarSyncResult | null>(null);

  /** Pull the error code out of the OAuth callback redirect, if there was one. */
  useEffect(() => {
    const code = searchParams.get("error");
    if (code) {
      setError(OAUTH_ERRORS[code] ?? `Google sign-in failed (${code}).`);
    }
  }, [searchParams]);

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/calendar/status");
    if (!response.ok) {
      setStatus(null);
      return null;
    }
    const data = (await response.json()) as GoogleCalendarStatus;
    setStatus(data);
    return data;
  }, []);

  const loadCalendars = useCallback(async () => {
    const response = await fetch("/api/calendar/calendars");
    if (!response.ok) {
      // A revoked token surfaces here first; status will already have been cleared
      // server-side, so just re-read it rather than showing a stale dropdown.
      setCalendars([]);
      return;
    }
    const data = (await response.json()) as {
      calendars: GoogleCalendarOption[];
    };
    setCalendars(data.calendars);
  }, []);

  useEffect(() => {
    void (async () => {
      const current = await loadStatus();
      if (current?.connected) {
        await loadCalendars();
      }
      setLoading(false);
    })();
  }, [loadStatus, loadCalendars]);

  /** Wrap an action with busy state and consistent error reporting. */
  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }, []);

  async function readError(response: Response): Promise<string> {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    return body?.error ?? `Request failed (${response.status})`;
  }

  const handleSync = () =>
    run("sync", async () => {
      const response = await fetch("/api/calendar/sync", { method: "POST" });
      if (!response.ok) {
        await loadStatus();
        throw new Error(await readError(response));
      }
      setSyncResult((await response.json()) as CalendarSyncResult);
      await loadStatus();
    });

  const handleSelectCalendar = (calendarId: string) =>
    run("select", async () => {
      const response = await fetch("/api/calendar/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendarId }),
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      setSyncResult(null);
      await loadStatus();
    });

  const handleDisconnect = () =>
    run("disconnect", async () => {
      const response = await fetch("/api/calendar/disconnect", {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(await readError(response));
      }
      setSyncResult(null);
      setCalendars([]);
      await loadStatus();
    });

  if (loading) {
    return <main style={{ padding: 24 }}>Loading…</main>;
  }

  return (
    <main style={{ padding: 24, maxWidth: 640 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        Google Calendar
      </h1>

      {error && (
        <p style={{ color: "#b00020", marginBottom: 16 }} role="alert">
          {error}
        </p>
      )}

      {!status?.connected ? (
        <>
          <p style={{ marginBottom: 16 }}>
            Connect your Google account to sync your scheduled rides to your
            calendar.
          </p>
          {/* A plain link, not fetch: the connect route is a redirect to Google. */}
          <a href="/api/calendar/google/connect">
            <BogButton>Connect Google Calendar</BogButton>
          </a>
        </>
      ) : (
        <>
          <dl style={{ marginBottom: 24, lineHeight: 1.8 }}>
            <div>
              <strong>Account:</strong> {status.googleEmail ?? "Connected"}
            </div>
            <div>
              <strong>Connected:</strong> {formatTimestamp(status.connectedAt)}
            </div>
            <div>
              <strong>Last synced:</strong>{" "}
              {formatTimestamp(status.lastSyncedAt)}
            </div>
            <div>
              <strong>Events on calendar:</strong> {status.syncedEventCount}
            </div>
          </dl>

          <label style={{ display: "block", marginBottom: 24 }}>
            <span style={{ display: "block", marginBottom: 4 }}>
              Sync rides to:
            </span>
            <select
              value={status.calendarId ?? "primary"}
              disabled={busy !== null || calendars.length === 0}
              onChange={(e) => void handleSelectCalendar(e.target.value)}
              style={{ padding: 8, minWidth: 280 }}
            >
              {calendars.length === 0 && (
                <option value={status.calendarId ?? "primary"}>
                  {status.calendarId ?? "primary"}
                </option>
              )}
              {calendars.map((calendar) => (
                <option key={calendar.id} value={calendar.id}>
                  {calendar.summary}
                  {calendar.primary ? " (default)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div style={{ display: "flex", gap: 12 }}>
            <BogButton
              onClick={() => void handleSync()}
              disabled={busy !== null}
            >
              {busy === "sync" ? "Syncing…" : "Sync now"}
            </BogButton>
            <BogButton
              variant="secondary"
              onClick={() => void handleDisconnect()}
              disabled={busy !== null}
            >
              {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </BogButton>
          </div>

          {syncResult && (
            <p style={{ marginTop: 16 }}>
              Synced: {syncResult.created} added, {syncResult.updated} updated,{" "}
              {syncResult.deleted} removed, {syncResult.unchanged} unchanged.
            </p>
          )}
        </>
      )}
    </main>
  );
}
