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
import { Prisma, RouteStatus } from "@db/generated/client";
import { emitRouteUpdate } from "@/server/notifications/emitRouteUpdate";
import { notifyRideSeriesCancelled } from "@/server/notifications/routeNotifications";
import { addDays, endOfDay, set } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { cancelRoute, createRoute } from "./RouteAction";
import type { MaterializeResult } from "@/types/rideSeries";
import type { RecurrenceRequest } from "@/schemas/rideSeries";
import { createRouteSchema, type CreateRouteInput } from "@/schemas/ride";
import { ArgumentError, ConflictError, NotFoundError } from "@/utils/errors";
import { recurrenceRequestSchema } from "@/schemas/rideSeries";
import { recordAudit } from "@db/audit";

const TZ = "America/New_York";

function seriesAuditSnapshot(series: {
  id: string;
  studentId: string;
  pickupLocation: string;
  dropoffLocation: string;
  frequency: string;
  daysOfWeek: number[];
  firstPickupTime: Date;
  endsAt: Date | null;
  pickupWindowStartOffsetMs: number;
  pickupWindowEndOffsetMs: number;
  materializedThrough: Date;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: series.id,
    studentId: series.studentId,
    pickupLocation: series.pickupLocation,
    dropoffLocation: series.dropoffLocation,
    frequency: series.frequency,
    daysOfWeek: series.daysOfWeek,
    firstPickupTime: series.firstPickupTime,
    endsAt: series.endsAt,
    pickupWindowStartOffsetMs: series.pickupWindowStartOffsetMs,
    pickupWindowEndOffsetMs: series.pickupWindowEndOffsetMs,
    materializedThrough: series.materializedThrough,
    active: series.active,
    createdAt: series.createdAt,
    updatedAt: series.updatedAt,
  };
}

/** How far ahead rides are kept scheduled, in Eastern calendar days. */
export const SCHEDULING_HORIZON_DAYS = 28;

/**
 * The first occurrence on a later Eastern day than `after`, falling on one of
 * `daysOfWeek` at the first ride's time of day.
 *
 * `after` is always a previous occurrence (or the first ride), so its Eastern
 * date is the day already handled. The arithmetic happens in Eastern wall-clock
 * time, so a 1:00 PM ride stays 1:00 PM across a DST boundary instead of sliding
 * to 12:00 or 2:00.
 */
export function nextOccurrence(
  firstPickupTime: Date,
  daysOfWeek: number[],
  after: Date,
): Date {
  const timeOfDay = toZonedTime(firstPickupTime, TZ);
  const handled = toZonedTime(after, TZ);
  for (let offset = 1; offset <= 7; offset++) {
    const day = addDays(handled, offset);
    if (daysOfWeek.includes(day.getDay())) {
      return fromZonedTime(
        set(day, {
          hours: timeOfDay.getHours(),
          minutes: timeOfDay.getMinutes(),
          seconds: timeOfDay.getSeconds(),
          milliseconds: timeOfDay.getMilliseconds(),
        }),
        TZ,
      );
    }
  }
  throw new Error("Ride series has no days of week to repeat on");
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
            include: {
              student: { select: { status: true } },
              pickup: { select: { status: true } },
              dropoff: { select: { status: true } },
            },
          });
          if (!series?.active) return null;
          if (
            series.student.status === "archived" ||
            series.pickup.status === "archived" ||
            series.dropoff.status === "archived"
          )
            return null;

          const next = nextOccurrence(
            series.firstPickupTime,
            series.daysOfWeek,
            series.materializedThrough,
          );
          // Past its end date the series has nothing left to generate, so retire
          // it instead of rechecking it on every cron tick.
          if (series.endsAt && next > series.endsAt) {
            const retired = await tx.rideSeries.update({
              where: { id: seriesId },
              data: { active: false },
            });
            // System action (no actor): the series ran past its end date.
            await recordAudit(tx, {
              entityType: "RideSeries",
              entityId: retired.id,
              action: "Update",
              before: seriesAuditSnapshot(series),
              after: seriesAuditSnapshot(retired),
            });
            return null;
          }
          if (next > horizon) return null;
          // Missed occurrences are processed permanently, without creating old
          // requests or asking Mapbox for travel estimates in the past.
          if (next <= new Date()) {
            const updated = await tx.rideSeries.update({
              where: { id: seriesId },
              data: { materializedThrough: next },
            });
            await recordAudit(tx, {
              entityType: "RideSeries",
              entityId: updated.id,
              action: "Update",
              before: seriesAuditSnapshot(series),
              after: seriesAuditSnapshot(updated),
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
                { seriesId, tx, actorId: null },
              );
          const updatedSeries = await tx.rideSeries.update({
            where: { id: seriesId },
            data: { materializedThrough: next },
          });
          await recordAudit(tx, {
            entityType: "RideSeries",
            entityId: updatedSeries.id,
            action: "Update",
            before: seriesAuditSnapshot(series),
            after: seriesAuditSnapshot(updatedSeries),
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
  actorId: string,
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

  const firstWeekday = toZonedTime(data.scheduledPickupTime, TZ).getDay();
  const daysOfWeek = [...new Set(recurrence.daysOfWeek ?? [firstWeekday])].sort(
    (a, b) => a - b,
  );
  if (!daysOfWeek.includes(firstWeekday)) {
    throw new ArgumentError("Repeat days must include the first ride's day");
  }
  const endsAt = recurrence.endsOn
    ? fromZonedTime(`${recurrence.endsOn}T23:59:59.999`, TZ)
    : null;
  if (endsAt && endsAt < data.scheduledPickupTime) {
    throw new ArgumentError(
      "Recurring rides must end on or after the first ride",
    );
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
            daysOfWeek,
            firstPickupTime: data.scheduledPickupTime,
            endsAt,
            pickupWindowStartOffsetMs: windowStartOffset,
            pickupWindowEndOffsetMs: windowEndOffset,
            materializedThrough: data.scheduledPickupTime,
          },
        });
        await recordAudit(tx, {
          actorId,
          entityType: "RideSeries",
          entityId: series.id,
          action: "Create",
          after: seriesAuditSnapshot(series),
        });
        const firstRoute = await createRoute(data, {
          seriesId: series.id,
          tx,
          actorId,
        });
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
export async function deactivateRideSeries(
  seriesId: string,
  actorId: string | null = null,
): Promise<boolean> {
  const changed = await db.$transaction(async (tx) => {
    const before = await tx.rideSeries.findUnique({
      where: { id: seriesId.toLowerCase() },
    });
    if (!before) return false;
    const updated = await tx.rideSeries.update({
      where: { id: before.id },
      data: { active: false },
    });
    await recordAudit(tx, {
      actorId,
      entityType: "RideSeries",
      entityId: updated.id,
      action: "Update",
      before: seriesAuditSnapshot(before),
      after: seriesAuditSnapshot(updated),
    });
    return true;
  });
  return changed;
}

/** Later rides that haven't started yet; in-progress or finished rides are left alone. */
const FUTURE_CANCELLABLE_STATUSES: RouteStatus[] = [
  RouteStatus.Requested,
  RouteStatus.ActionRequiredByAdmin,
  RouteStatus.ActionRequiredByStudent,
  RouteStatus.Scheduled,
];

/**
 * Cancel a recurring ride together with every later ride in its series, and stop
 * the series from generating more.
 *
 * The selected ride is cancelled first so an invalid state (already finished,
 * already cancelled) fails before anything else changes. The series is stopped
 * next, before later rides are looked up: deactivating waits on the row lock a
 * running materialization holds, so any ride it was creating is committed and
 * visible to the lookup, and no new ride can appear afterwards. Each later ride
 * goes through the normal cancellation path (audit, pending-change resolution),
 * but notifications are batched: each person gets one toast and one email for
 * the whole series rather than one per ride. Earlier and in-progress rides keep
 * their history.
 */
export async function cancelRideSeriesFrom(
  routeId: string,
  status:
    typeof RouteStatus.CancelledByStudent | typeof RouteStatus.CancelledByAdmin,
  actorId: string,
) {
  const selected = await db.route.findUnique({
    where: { id: routeId.toLowerCase() },
    select: { id: true, seriesId: true, scheduledPickupTime: true },
  });
  if (!selected) throw new NotFoundError("Route not found");
  if (!selected.seriesId)
    throw new ArgumentError("Ride is not part of a recurring series");

  const route = await cancelRoute(selected.id, status, actorId, {
    notify: false,
  });
  const cancelled = [route];
  try {
    await deactivateRideSeries(selected.seriesId, actorId);

    const later = await db.route.findMany({
      where: {
        seriesId: selected.seriesId,
        scheduledPickupTime: { gt: selected.scheduledPickupTime },
        status: { in: FUTURE_CANCELLABLE_STATUSES },
      },
      select: { id: true },
      orderBy: { scheduledPickupTime: "asc" },
    });
    for (const { id } of later) {
      try {
        cancelled.push(
          await cancelRoute(id, status, actorId, { notify: false }),
        );
      } catch (error) {
        // The ride changed state (or was removed) since the lookup; leave it be.
        if (error instanceof ConflictError || error instanceof NotFoundError)
          continue;
        throw error;
      }
    }
  } finally {
    // Whatever was cancelled before a failure still needs to be announced.
    void notifyRideSeriesCancelled(cancelled);
  }
  return { route, cancelledCount: cancelled.length };
}
