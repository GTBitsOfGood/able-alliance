import { debugLog } from "../utils/logger.js";

/**
 * Scheduled trigger for recurring-ride generation.
 *
 * Route creation stays in the Next app so API requests and scheduled generation
 * use the same PostgreSQL validation, travel estimates, and real-time events.
 *
 * Safe to fire more often than needed: PostgreSQL transactions serialize each
 * series, and generation is idempotent, so an extra tick is a no-op.
 */

/** How often to poke the materializer. */
const INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

/** Delay before the first run, so startup isn't competing with it. */
const STARTUP_DELAY_MS = 30 * 1000;

const REQUEST_TIMEOUT_MS = 60 * 1000;

function appBaseUrl(): string | undefined {
  return process.env.APP_INTERNAL_URL ?? process.env.DEPLOY_PRIME_URL;
}

async function runOnce(): Promise<void> {
  const base = appBaseUrl();
  const secret = process.env.WEBSOCKET_INTERNAL_SECRET;

  if (!base || !secret) {
    console.error(
      "[rideSeriesCron] APP_INTERNAL_URL/DEPLOY_PRIME_URL or WEBSOCKET_INTERNAL_SECRET not set; skipping",
    );
    return;
  }

  try {
    const response = await fetch(
      new URL("/api/internal/ride-series/materialize", base),
      {
        method: "POST",
        headers: { "x-internal-secret": secret },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: "error",
      },
    );

    if (!response.ok) {
      console.error(
        `[rideSeriesCron] materialize failed with status ${response.status}`,
      );
      return;
    }

    const body = (await response.json().catch(() => null)) as {
      seriesProcessed?: number;
      ridesCreated?: number;
      ridesSkipped?: number;
    } | null;

    debugLog(
      `[rideSeriesCron] ok: series=${body?.seriesProcessed ?? "?"} ` +
        `created=${body?.ridesCreated ?? "?"} skipped=${body?.ridesSkipped ?? "?"}`,
    );
  } catch (error) {
    // Never throw: a failed tick must not take the websocket server down.
    console.error("[rideSeriesCron] request failed", error);
  }
}

/**
 * Start the recurring job. Returns a stop function so the server can clear the
 * timers on shutdown (and so tests don't leak an open handle).
 */
export function startRideSeriesCron(): () => void {
  let interval: NodeJS.Timeout | undefined;

  const startupTimer = setTimeout(() => {
    void runOnce();
    interval = setInterval(() => void runOnce(), INTERVAL_MS);
    interval.unref?.();
  }, STARTUP_DELAY_MS);
  startupTimer.unref?.();

  console.log("[rideSeriesCron] scheduled daily (every 24 hours)");

  return () => {
    clearTimeout(startupTimer);
    if (interval) {
      clearInterval(interval);
    }
  };
}
