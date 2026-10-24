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
 *    together with the watermark in a transaction that locks the series row.
 *    Concurrent workers serialize per series, and a crash rolls back both writes.
 *  - **Edits and cancellations stick.** Because the watermark never moves back,
 *    an occurrence that has already been generated is never reconsidered. Editing
 *    or cancelling a ride can't resurrect it.
 *  - **No double-booking the student.** If a ride already exists at that exact
 *    pickup instant, the occurrence is skipped. Per the ticket, overlapping
 *    pickup *windows* are not a conflict — only an identical pickup time is.
 */

import { db } from "@db";
import { Prisma } from "@db/generated/client";
import { emitRouteUpdate } from "@/server/notifications/emitRouteUpdate";
import { addDays, addWeeks, endOfDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { createRoute } from "./RouteAction";
import type { MaterializeResult } from "@/utils/types/rideSeries";
import type { RecurrenceRequest } from "@/utils/types/rideSeries";
import { createRouteSchema, type CreateRouteInput } from "@/utils/types";
import { ArgumentError, ConflictError } from "@/utils/errors";
import { recurrenceRequestSchema } from "@/utils/types/rideSeries";

const TZ = "America/New_York";

/** How far ahead rides are kept scheduled, in Eastern calendar days. */
export const SCHEDULING_HORIZON_DAYS = 28;

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

/** Generate occurrences using one transaction per occurrence. */
async function materializeSeries(
  seriesId: string,
  horizon: Date,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (;;) {
    try {
      const result = await db.$transaction(
        async (tx) => {
          // Lock the row
          await tx.$queryRaw(Prisma.sql`
            SELECT "id" FROM "RideSeries" WHERE "id" = ${seriesId}::uuid FOR UPDATE
          `);
          const series = await tx.rideSeries.findUnique({
            where: { id: seriesId },
          });
          if (!series?.active) return null;

          const elapsedMs =
            series.materializedThrough.getTime() -
            series.firstPickupTime.getTime();
          const weeksDone = Math.max(
            0,
            Math.round(elapsedMs / (7 * 86400 * 1000)),
          );
          const next = occurrenceAt(series.firstPickupTime, weeksDone + 1);
          if (next > horizon) return null;
          // Missed occurrences are processed permanently, without creating old
          // requests or asking Mapbox for travel estimates in the past.
          if (next <= new Date()) {
            await tx.rideSeries.update({
              where: { id: seriesId },
              data: { materializedThrough: next },
            });
            return { route: null };
          }

          const conflict = await tx.route.findUnique({
            where: {
              studentId_scheduledPickupTime: {
                studentId: series.studentId,
                scheduledPickupTime: next,
              },
            },
            select: { id: true },
          });
          const route = conflict
            ? null
            : await createRoute(
                {
                  pickupLocation: series.pickupLocation,
                  dropoffLocation: series.dropoffLocation,
                  student: series.studentId,
                  scheduledPickupTime: next,
                  pickupWindowStart: new Date(
                    next.getTime() + series.pickupWindowStartOffsetMs,
                  ),
                  pickupWindowEnd: new Date(
                    next.getTime() + series.pickupWindowEndOffsetMs,
                  ),
                },
                { seriesId, tx },
              );
          await tx.rideSeries.update({
            where: { id: seriesId },
            data: { materializedThrough: next },
          });
          return { route };
        },
        { timeout: 60000 },
      );

      if (!result) break;
      if (result.route) {
        created++;
        emitRouteUpdate(result.route);
      } else {
        skipped++;
      }
    } catch (error) {
      // A one-off request or another series can book the same student/time
      // concurrently. Retry in a new transaction after the unique violation
      // rolled back; it will see the conflicting ride and advance safely.
      if (error instanceof ConflictError) continue;
      throw error;
    }
  }
  return { created, skipped };
}

/** Bring all active series up to the horizon; concurrent passes are safe. */
export async function materializeDueSeries(
  now = new Date(),
): Promise<MaterializeResult> {
  const horizon = schedulingHorizon(now);
  const due = await db.rideSeries.findMany({
    where: { active: true, materializedThrough: { lt: horizon } },
    select: { id: true },
  });
  let ridesCreated = 0;
  let ridesSkipped = 0;
  for (const series of due) {
    try {
      const result = await materializeSeries(series.id, horizon);
      ridesCreated += result.created;
      ridesSkipped += result.skipped;
    } catch (error) {
      // One failing series must not stall the rest.
      console.error(`[RideSeries] series ${series.id} failed:`, error);
    }
  }
  return { seriesProcessed: due.length, ridesCreated, ridesSkipped };
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
  data = createRouteSchema.parse(data);
  recurrence = recurrenceRequestSchema.parse(recurrence);
  if (data.scheduledPickupTime <= new Date()) {
    throw new ArgumentError("First recurring pickup must be in the future");
  }
  const windowStartOffset =
    data.pickupWindowStart.getTime() - data.scheduledPickupTime.getTime();
  const windowEndOffset =
    data.pickupWindowEnd.getTime() - data.scheduledPickupTime.getTime();

  if (windowEndOffset < windowStartOffset) {
    throw new ArgumentError(
      "Pickup window end must not be before pickup window start",
    );
  }
  if (
    [windowStartOffset, windowEndOffset].some(
      (offset) => offset < -2147483648 || offset > 2147483647,
    )
  ) {
    throw new ArgumentError("Pickup window offsets are out of range");
  }

  // The template and first ride become visible together. A failed first ride
  // rolls back the template, so the cron cannot generate orphaned future rides.
  let created;
  try {
    created = await db.$transaction(
      async (tx) => {
        const series = await tx.rideSeries.create({
          data: {
            studentId: data.student.toLowerCase(),
            pickupLocation: data.pickupLocation.toLowerCase(),
            dropoffLocation: data.dropoffLocation.toLowerCase(),
            frequency: recurrence.frequency,
            firstPickupTime: data.scheduledPickupTime,
            pickupWindowStartOffsetMs: windowStartOffset,
            pickupWindowEndOffsetMs: windowEndOffset,
            materializedThrough: data.scheduledPickupTime,
          },
        });
        const firstRoute = await createRoute(data, { seriesId: series.id, tx });
        return { series, firstRoute };
      },
      { timeout: 60000 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      throw new ArgumentError("Referenced location or student not found");
    }
    throw error;
  }
  const { series, firstRoute } = created;

  emitRouteUpdate(firstRoute);

  // Fill forward now; a transient failure is retried by the scheduled job.
  try {
    await materializeSeries(series.id, schedulingHorizon());
  } catch (error) {
    console.error("[RideSeries] initial fill-forward failed:", error);
  }

  return { series, firstRoute };
}

/** Stop future generation for a series without touching rides already created. */
export async function deactivateRideSeries(seriesId: string): Promise<boolean> {
  const { count } = await db.rideSeries.updateMany({
    where: { id: seriesId.toLowerCase() },
    data: { active: false },
  });
  return count !== 0;
}
