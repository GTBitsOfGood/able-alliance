/**
 * Recurring ride series: creation and scheduled materialization.
 *
 * A series stores only the template. Actual rides are generated ahead of time by
 * `materializeDueSeries`, which the websocket server's cron triggers.
 *
 * Three properties the job has to hold, and how:
 *
 *  - **No duplicates across runs/restarts/overlap.** Each series carries a
 *    `materializedThrough` watermark that only moves forward. Rides are created
 *    before the watermark advances, so a crash in between retries the create —
 *    which the unique `(seriesId, scheduledPickupTime)` index then rejects, and
 *    we treat that rejection as "already done".
 *  - **Edits and cancellations stick.** Because the watermark never moves back,
 *    an occurrence that has already been generated is never reconsidered. Editing
 *    or cancelling a ride can't resurrect it.
 *  - **No double-booking the student.** If a ride already exists at that exact
 *    pickup instant, the occurrence is skipped. Per the ticket, overlapping
 *    pickup *windows* are not a conflict — only an identical pickup time is.
 */

import mongoose from "mongoose";
import { addDays, addWeeks, endOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import connectMongoDB from "../mongodb";
import RideSeriesModel from "../models/RideSeriesModel";
import RouteModel from "../models/RouteModel";
import JobLockModel from "../models/JobLockModel";
import { createRoute } from "./RouteAction";
import type { MaterializeResult } from "@/utils/types/rideSeries";
import type { RecurrenceRequest } from "@/utils/types/rideSeries";
import type { CreateRouteInput } from "@/utils/types";
import { RideSeriesInvalidException } from "@/utils/exceptions/rideSeries";
import { RouteAlreadyExistsException } from "@/utils/exceptions/route";

const TZ = "America/New_York";

/** How far ahead rides are kept scheduled, in Eastern calendar days. */
export const SCHEDULING_HORIZON_DAYS = 28;

const LOCK_NAME = "rideSeriesMaterializer";
/** Lease length. Long enough for a slow pass, short enough to recover from a crash. */
const LOCK_TTL_MS = 5 * 60 * 1000;

/**
 * The pickup instant of occurrence `weeks` after the first ride.
 *
 * Addition happens in Eastern wall-clock time, so a 1:00 PM ride stays 1:00 PM
 * across a DST boundary instead of sliding to 12:00 or 2:00.
 */
export function occurrenceAt(firstPickupTime: Date, weeks: number): Date {
  const zoned = toZonedTime(firstPickupTime, TZ);
  return fromZonedTime(addWeeks(zoned, weeks), TZ);
}

/**
 * Last instant that may be scheduled right now: the end of the Eastern day
 * `SCHEDULING_HORIZON_DAYS` out, so a ride exactly 28 days away is included.
 *
 * The day arithmetic happens in Eastern wall-clock time, not the server's local
 * time. Adding days to a UTC instant shifts by 28x24h, which is an hour off
 * across a DST boundary — enough to land on the previous Eastern day and leave
 * the horizon a day short for anyone booking between midnight and 1 AM Eastern.
 */
export function schedulingHorizon(now = new Date()): Date {
  const zonedTarget = addDays(toZonedTime(now, TZ), SCHEDULING_HORIZON_DAYS);
  return fromZonedTime(endOfDay(zonedTarget), TZ);
}

/** True when the student already has a ride at exactly this pickup instant. */
async function hasConflictingRide(
  studentId: mongoose.Types.ObjectId,
  pickupTime: Date,
): Promise<boolean> {
  const existing = await RouteModel.findOne({
    "student._id": studentId,
    scheduledPickupTime: pickupTime,
  })
    .select("_id")
    .lean();
  return existing !== null;
}

function isDuplicateKeyError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    (e as { code?: number }).code === 11000
  );
}

/**
 * Generate every occurrence of one series that is due but not yet materialized.
 * Safe to call concurrently with itself — see the module comment.
 */
async function materializeSeries(
  seriesId: mongoose.Types.ObjectId,
  horizon: Date,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  // Re-read inside the loop: another pass may have advanced the watermark.
  for (;;) {
    const series = await RideSeriesModel.findById(seriesId).lean();
    if (!series || !series.active) {
      break;
    }

    // Walk forward from the watermark to the next unmaterialized occurrence.
    const elapsedMs =
      series.materializedThrough.getTime() - series.firstPickupTime.getTime();
    const weeksDone = Math.max(0, Math.round(elapsedMs / (7 * 86400 * 1000)));
    const next = occurrenceAt(series.firstPickupTime, weeksDone + 1);

    if (next > horizon) {
      break;
    }

    const conflict = await hasConflictingRide(series.student, next);
    if (!conflict) {
      try {
        await createRoute(
          {
            pickupLocation: String(series.pickupLocation),
            dropoffLocation: String(series.dropoffLocation),
            student: String(series.student),
            scheduledPickupTime: next,
            pickupWindowStart: new Date(
              next.getTime() + series.pickupWindowStartOffsetMs,
            ),
            pickupWindowEnd: new Date(
              next.getTime() + series.pickupWindowEndOffsetMs,
            ),
          } as CreateRouteInput,
          { seriesId: String(seriesId) },
        );
        created++;
      } catch (e) {
        if (
          isDuplicateKeyError(e) ||
          e instanceof RouteAlreadyExistsException
        ) {
          // Lost a race: either a concurrent pass created this occurrence, or the
          // student booked that slot between our conflict check and the insert.
          // Either way the desired end state holds, so fall through and advance
          // the watermark rather than retrying this occurrence forever.
          skipped++;
        } else {
          throw e;
        }
      }
    } else {
      skipped++;
    }

    // Advance only from the watermark we read, so a concurrent pass that already
    // moved it wins and we re-read rather than double-advancing.
    const advanced = await RideSeriesModel.findOneAndUpdate(
      { _id: seriesId, materializedThrough: series.materializedThrough },
      { $set: { materializedThrough: next } },
    ).lean();

    if (!advanced) {
      // Someone else moved it. Loop re-reads and continues from the new position.
      continue;
    }
  }

  return { created, skipped };
}

/**
 * Try to take the job lease. Returns false when another run already holds it.
 *
 * The upsert either matches an expired/absent lock and takes it, or fails the
 * unique _id constraint because a live lock exists — which is the signal to bow out.
 */
async function acquireLock(now: Date): Promise<string | null> {
  // Identifies this run so release can verify it still owns the lease.
  const token = new mongoose.Types.ObjectId().toHexString();
  try {
    await JobLockModel.findOneAndUpdate(
      { _id: LOCK_NAME, lockedUntil: { $lte: now } },
      {
        $set: {
          lockedUntil: new Date(now.getTime() + LOCK_TTL_MS),
          lockedAt: now,
          token,
        },
      },
      { upsert: true },
    );
    return token;
  } catch (e) {
    if (isDuplicateKeyError(e)) {
      return null;
    }
    throw e;
  }
}

/**
 * Release only if we still hold the lease.
 *
 * A run that overran its TTL has already lost the lock to someone else; clearing
 * it unconditionally would hand a second run's lease away mid-pass and let a
 * third run in alongside it.
 */
async function releaseLock(token: string): Promise<void> {
  await JobLockModel.updateOne(
    { _id: LOCK_NAME, token },
    { $set: { lockedUntil: new Date(0) } },
  );
}

/**
 * One scheduled pass: bring every active series up to the 28-day horizon.
 * Returns zeroed counts (and does nothing) if another run holds the lease.
 */
export async function materializeDueSeries(
  now = new Date(),
): Promise<MaterializeResult> {
  await connectMongoDB();

  const empty: MaterializeResult = {
    seriesProcessed: 0,
    ridesCreated: 0,
    ridesSkipped: 0,
  };

  const lockToken = await acquireLock(now);
  if (!lockToken) {
    console.log("[RideSeries] another run holds the lock; skipping this pass");
    return empty;
  }

  try {
    const horizon = schedulingHorizon(now);
    const due = await RideSeriesModel.find({
      active: true,
      materializedThrough: { $lt: horizon },
    })
      .select("_id")
      .lean();

    let ridesCreated = 0;
    let ridesSkipped = 0;

    for (const series of due) {
      try {
        const result = await materializeSeries(series._id, horizon);
        ridesCreated += result.created;
        ridesSkipped += result.skipped;
      } catch (e) {
        // One bad series (deleted location, etc.) must not stall the rest.
        console.error(`[RideSeries] series ${series._id} failed:`, e);
      }
    }

    return { seriesProcessed: due.length, ridesCreated, ridesSkipped };
  } finally {
    await releaseLock(lockToken);
  }
}

/**
 * Create a series from the ride the student just filled in, plus that first ride.
 *
 * The first ride is created immediately so the student sees it right away, then
 * the series is brought up to the horizon in the same request rather than waiting
 * for the next cron tick.
 */
export async function createRideSeries(
  data: CreateRouteInput,
  recurrence: RecurrenceRequest,
) {
  await connectMongoDB();

  const windowStartOffset =
    data.pickupWindowStart.getTime() - data.scheduledPickupTime.getTime();
  const windowEndOffset =
    data.pickupWindowEnd.getTime() - data.scheduledPickupTime.getTime();

  if (windowEndOffset < windowStartOffset) {
    throw new RideSeriesInvalidException(
      "Pickup window end must not be before pickup window start",
    );
  }

  // Created inactive so the hourly job can't pick it up and generate future
  // rides while the first ride is still in flight — if that first ride then
  // fails and we delete the series, those rides would be orphaned.
  const series = await RideSeriesModel.create({
    student: data.student,
    pickupLocation: data.pickupLocation,
    dropoffLocation: data.dropoffLocation,
    frequency: recurrence.frequency,
    firstPickupTime: data.scheduledPickupTime,
    pickupWindowStartOffsetMs: windowStartOffset,
    pickupWindowEndOffsetMs: windowEndOffset,
    // The first ride is created below, so the watermark starts there.
    materializedThrough: data.scheduledPickupTime,
    active: false,
  });

  let firstRoute;
  try {
    firstRoute = await createRoute(data, { seriesId: String(series._id) });
  } catch (e) {
    // Nothing else can have referenced it yet: it was never active.
    await RideSeriesModel.findByIdAndDelete(series._id);
    throw e;
  }

  // Safe to publish now that the first ride exists.
  await RideSeriesModel.findByIdAndUpdate(series._id, {
    $set: { active: true },
  });

  // Fill out the rest of the horizon now rather than on the next tick.
  const horizon = schedulingHorizon();
  try {
    await materializeSeries(series._id, horizon);
  } catch (e) {
    // The cron will pick this up; the student already has their first ride.
    console.error("[RideSeries] initial fill-forward failed:", e);
  }

  return { series: series.toObject(), firstRoute };
}

/** Stop future generation for a series without touching rides already created. */
export async function deactivateRideSeries(seriesId: string): Promise<boolean> {
  await connectMongoDB();
  const updated = await RideSeriesModel.findByIdAndUpdate(seriesId, {
    $set: { active: false },
  }).lean();
  return updated !== null;
}
