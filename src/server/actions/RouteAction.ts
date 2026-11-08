import { HTTP_STATUS_CODE } from "@/utils/consts";
import { EDITABLE_RIDE_STATUSES } from "@/utils/route-status";
import type { EditRouteInput } from "@/schemas/ride";
import { hasUserType } from "@/utils/userTypes";
import { findBookingConflicts } from "@/server/autoSchedule";
import { db } from "@db";
import { Prisma, RouteStatus } from "@db/generated/client";
import type { UserType } from "@db/generated/browser";
import {
  userInclude,
  adminRouteInclude,
  studentRouteInclude,
  driverRouteInclude,
} from "@/server/queries";
import { isAdmin } from "@/utils/authUser";
import { createRouteSchema, type CreateRouteInput } from "@/schemas/ride";
import {
  ArgumentError,
  ConflictError,
  NotFoundError,
  HttpError,
} from "@/utils/errors";
import { getMapboxTravelDuration } from "@/server/mapbox";
import { estDateKey, estDayOfWeek, estTimeStr } from "@/utils/dateEst";
import { emitRouteUpdate } from "@/server/notifications/emitRouteUpdate";
import {
  MAX_DELAY_MINUTES,
  STUDENT_EDIT_MIN_NOTICE_HOURS,
  SERVICE_START_TIME,
  SERVICE_END_TIME,
} from "@/utils/consts";
import {
  notifyRideStatusChanged,
  notifyRideDelayed,
  notifyRideAssigned,
  notifyRideChangesAccepted,
} from "@/server/notifications/routeNotifications";
import { recordAudit } from "@db/audit";

function routeAuditSnapshot(route: {
  id: string;
  pickupLocation: string;
  dropoffLocation: string;
  studentId: string;
  driverId: string | null;
  vehicleId: string | null;
  scheduledPickupTime: Date;
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
  estimatedDropoffTime: Date | null;
  delayMinutes: number;
  status: RouteStatus;
  seriesId: string | null;
}) {
  return {
    id: route.id,
    pickupLocation: route.pickupLocation,
    dropoffLocation: route.dropoffLocation,
    studentId: route.studentId,
    driverId: route.driverId,
    vehicleId: route.vehicleId,
    scheduledPickupTime: route.scheduledPickupTime,
    pickupWindowStart: route.pickupWindowStart,
    pickupWindowEnd: route.pickupWindowEnd,
    estimatedDropoffTime: route.estimatedDropoffTime,
    delayMinutes: route.delayMinutes,
    status: route.status,
    seriesId: route.seriesId,
  };
}

export async function createRoute(
  data: CreateRouteInput,
  options?: {
    seriesId?: string;
    tx?: Prisma.TransactionClient;
    actorId?: string | null;
  },
) {
  const client = options?.tx ?? db;
  const parsed = createRouteSchema.parse(data);
  const input = {
    ...parsed,
    pickupLocation: parsed.pickupLocation.toLowerCase(),
    dropoffLocation: parsed.dropoffLocation.toLowerCase(),
    student: parsed.student.toLowerCase(),
  };
  const [pickup, dropoff, student] = await Promise.all([
    client.location.findUnique({ where: { id: input.pickupLocation } }),
    client.location.findUnique({ where: { id: input.dropoffLocation } }),
    client.user.findUnique({ where: { id: input.student } }),
  ]);
  if (!pickup) throw new ArgumentError("Pickup location not found");
  if (!dropoff) throw new ArgumentError("Dropoff location not found");
  if (!student) throw new ArgumentError("Student not found");
  if (!hasUserType(student, "Student"))
    throw new ArgumentError("Referenced user is not a student");
  const existing = await client.route.findUnique({
    where: {
      studentId_scheduledPickupTime: {
        studentId: student.id,
        scheduledPickupTime: input.scheduledPickupTime,
      },
    },
  });
  if (existing) throw new ConflictError("Route already exists");
  const seconds = await getMapboxTravelDuration(
    pickup.latitude,
    pickup.longitude,
    dropoff.latitude,
    dropoff.longitude,
    input.scheduledPickupTime,
  );
  const persist = async (tx: Prisma.TransactionClient) => {
    const route = await tx.route.create({
      data: {
        pickupLocation: input.pickupLocation,
        dropoffLocation: input.dropoffLocation,
        scheduledPickupTime: input.scheduledPickupTime,
        pickupWindowStart: input.pickupWindowStart,
        pickupWindowEnd: input.pickupWindowEnd,
        studentId: student.id,
        seriesId: options?.seriesId?.toLowerCase(),
        status: RouteStatus.Requested,
        estimatedDropoffTime:
          seconds !== null
            ? new Date(input.scheduledPickupTime.getTime() + seconds * 1000)
            : undefined,
      },
      include: studentRouteInclude,
    });
    await recordAudit(tx, {
      actorId: options?.actorId,
      entityType: "Route",
      entityId: route.id,
      action: "Create",
      after: routeAuditSnapshot(route),
    });
    return route;
  };
  try {
    const route = options?.tx
      ? await persist(options.tx)
      : await db.$transaction(persist);
    if (!options?.tx) emitRouteUpdate(route);
    return route;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        throw new ConflictError("Route already exists");
      if (error.code === "P2003")
        throw new ArgumentError("Referenced location or user not found");
    }
    throw error;
  }
}

export async function getRouteById(id: string, role: UserType) {
  const where = { id: id.toLowerCase() };
  const route = isAdmin(role)
    ? await db.route.findUnique({ where, include: adminRouteInclude })
    : role === "Driver"
      ? await db.route.findUnique({ where, include: driverRouteInclude })
      : await db.route.findUnique({ where, include: studentRouteInclude });
  if (!route) throw new NotFoundError("Route not found");
  return route;
}

export async function deleteRoute(id: string, actorId: string) {
  try {
    const route = await db.$transaction(async (tx) => {
      const removed = await tx.route.delete({
        where: { id: id.toLowerCase() },
        include: adminRouteInclude,
      });
      await recordAudit(tx, {
        actorId,
        entityType: "Route",
        entityId: removed.id,
        action: "Delete",
        before: routeAuditSnapshot(removed),
      });
      return removed;
    });
    emitRouteUpdate(route);
    return route;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") throw new NotFoundError("Route not found");
      if (error.code === "P2003")
        throw new ConflictError(
          "Route has chat history or a pending change and cannot be deleted",
        );
    }
    throw error;
  }
}

export async function getRoutes(
  filters:
    | {
        student?: string;
        driver?: string;
        vehicle?: string;
        status?: RouteStatus;
        start_time?: Date;
        end_time?: Date;
      }
    | undefined,
  role: UserType,
) {
  const where = {
    ...(filters?.student ? { studentId: filters.student.toLowerCase() } : {}),
    ...(filters?.driver ? { driverId: filters.driver.toLowerCase() } : {}),
    ...(filters?.vehicle ? { vehicleId: filters.vehicle.toLowerCase() } : {}),
    ...(filters?.status ? { status: filters.status } : {}),
    scheduledPickupTime: {
      gte: filters?.start_time,
      lte: filters?.end_time,
    },
  };

  return isAdmin(role)
    ? db.route.findMany({ include: adminRouteInclude, where })
    : db.route.findMany({ include: studentRouteInclude, where });
}

export const completeRoute = (routeId: string, actorId: string) =>
  transitionRoute(
    routeId,
    [RouteStatus.Pickedup],
    RouteStatus.Completed,
    actorId,
  );

export async function cancelRoute(
  routeId: string,
  status:
    typeof RouteStatus.CancelledByStudent | typeof RouteStatus.CancelledByAdmin,
  actorId: string,
  options?: { notify?: boolean; tx?: Prisma.TransactionClient },
) {
  if (
    status !== RouteStatus.CancelledByStudent &&
    status !== RouteStatus.CancelledByAdmin
  )
    throw new ArgumentError("Invalid cancellation status");
  const route = await transitionRoute(
    routeId,
    [
      RouteStatus.Requested,
      RouteStatus.ActionRequiredByAdmin,
      RouteStatus.ActionRequiredByStudent,
      RouteStatus.Scheduled,
      RouteStatus.EnRoute,
      RouteStatus.Arrived,
      RouteStatus.Pickedup,
    ],
    status,
    actorId,
    options,
  );
  return route;
}

export async function delayRoute(
  routeId: string,
  minutes: number,
  studentId: string,
) {
  if (
    !Number.isInteger(minutes) ||
    minutes <= 0 ||
    minutes > MAX_DELAY_MINUTES
  ) {
    throw new ArgumentError(
      `Delay must be a whole number from 1 to ${MAX_DELAY_MINUTES} minutes. Cancel your ride if you need longer.`,
    );
  }
  routeId = routeId.toLowerCase();
  const route = await db.$transaction(async (tx) => {
    // Only allow delay if route is Scheduled or EnRoute. Checking status in the same query
    // ensures that the route is not modified by another transaction like pickup or cancel
    const { count } = await tx.route.updateMany({
      where: {
        id: routeId,
        studentId: studentId.toLowerCase(),
        status: { in: [RouteStatus.Scheduled, RouteStatus.EnRoute] },
        // Check the total atomically so concurrent requests cannot exceed the ceiling.
        delayMinutes: { lte: MAX_DELAY_MINUTES - minutes },
      },
      data: { delayMinutes: { increment: minutes } },
    });

    if (count === 0) {
      const current = await tx.route.findUnique({
        where: { id: routeId },
        select: { id: true, status: true },
      });
      if (!current) {
        throw new NotFoundError("Route not found");
      }
      throw new ConflictError(
        `This ride cannot be delayed further. The total delay cannot exceed ${MAX_DELAY_MINUTES} minutes and the ride must be awaiting pickup. Cancel your ride if you need longer.`,
      );
    }

    const updated = await tx.route.findUniqueOrThrow({
      where: { id: routeId },
      include: adminRouteInclude,
    });
    // The increment holds the row lock until commit. Derive the prior total
    // from its result so concurrent delay requests get accurate audit entries.
    await recordAudit(tx, {
      actorId: studentId,
      entityType: "Route",
      entityId: updated.id,
      action: "Update",
      before: routeAuditSnapshot({
        ...updated,
        delayMinutes: updated.delayMinutes - minutes,
      }),
      after: routeAuditSnapshot(updated),
    });
    return updated;
  });
  emitRouteUpdate(route);

  void notifyRideDelayed(route);

  return route;
}

export const startRoute = (routeId: string, actorId: string) =>
  transitionRoute(
    routeId,
    [RouteStatus.Scheduled],
    RouteStatus.EnRoute,
    actorId,
  );

export const arriveRoute = (routeId: string, actorId: string) =>
  transitionRoute(routeId, [RouteStatus.EnRoute], RouteStatus.Arrived, actorId);

export const pickupStudent = (routeId: string, actorId: string) =>
  transitionRoute(
    routeId,
    [RouteStatus.Arrived],
    RouteStatus.Pickedup,
    actorId,
  );

export const markRouteMissing = (routeId: string, actorId: string) =>
  transitionRoute(routeId, [RouteStatus.Arrived], RouteStatus.Missing, actorId);

const LOCK_WAIT_MS = 10_000;
const LOCK_RETRY_MS = 150;

export function schedulingLockKeys(
  assignments: { driverId: string; vehicleId: string }[],
): string[] {
  return assignments.flatMap((a) => [
    `driver:${a.driverId.toLowerCase()}`,
    `vehicle:${a.vehicleId.toLowerCase()}`,
  ]);
}

export async function withSchedulingLock<T>(
  keys: string[],
  fn: (tx: Prisma.TransactionClient, afterCommit: (() => void)[]) => Promise<T>,
): Promise<T> {
  const afterCommit: (() => void)[] = [];
  const result = await db.$transaction(
    async (tx) => {
      const deadline = Date.now() + LOCK_WAIT_MS;
      // Transaction locks are released automatically on commit or rollback.
      // Sort resource keys so overlapping batches acquire them in the same order.
      for (const key of [...new Set(keys)].sort()) {
        for (;;) {
          const [result] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtextextended(${key}, 0)) AS locked
        `;
          if (result.locked) break;
          if (Date.now() >= deadline)
            throw new ConflictError("Scheduling is busy. Please try again.");
          await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS));
        }
      }
      return fn(tx, afterCommit);
    },
    { timeout: 120_000 },
  );
  for (const notify of afterCommit) notify();
  return result;
}

class AssignmentUnavailableError extends ConflictError {}

class InvalidAssignmentError extends ArgumentError {}

export class BookingConflictError extends ConflictError {
  constructor(readonly details: string[]) {
    super(
      "This assignment conflicts with existing bookings or accessibility requirements.",
    );
  }
}

/**
 * `from` lists the statuses the ride may be assigned out of. It defaults to
 * Requested — the first assignment. Admins can also change an assignment on
 * Scheduled rides or rides awaiting review without resolving the proposal.
 * Bulk and automatic scheduling keep the Requested-only default.
 */
export async function scheduleRoute(
  routeId: string,
  driverId: string,
  vehicleId: string,
  actorId: string,
  from: RouteStatus[] = [RouteStatus.Requested],
) {
  return withSchedulingLock(
    schedulingLockKeys([{ driverId, vehicleId }]),
    (tx, afterCommit) =>
      scheduleRouteWhileLocked(
        routeId,
        driverId,
        vehicleId,
        tx,
        afterCommit,
        actorId,
        from,
      ),
  );
}

/** Caller must hold the driver and vehicle locks in this transaction. */
export async function scheduleRouteWhileLocked(
  routeId: string,
  driverId: string,
  vehicleId: string,
  tx: Prisma.TransactionClient,
  afterCommit: (() => void)[],
  actorId: string,
  from: RouteStatus[] = [RouteStatus.Requested],
) {
  const assigned = await assignRoute(
    routeId,
    driverId,
    vehicleId,
    tx,
    actorId,
    from,
  );
  const { route } = assigned;

  afterCommit.push(() => {
    emitRouteUpdate(
      route,
      assigned.priorDriverId ? [assigned.priorDriverId] : [],
    );
    void notifyRideAssigned(assigned);
  });

  return route;
}

/** Every assignment path uses this transaction, including bulk shift assignment. */
async function assignRoute(
  routeId: string,
  driverId: string,
  vehicleId: string,
  tx: Prisma.TransactionClient,
  actorId: string,
  from: RouteStatus[] = [RouteStatus.Requested],
  audit = true,
) {
  routeId = routeId.toLowerCase();
  driverId = driverId.toLowerCase();
  vehicleId = vehicleId.toLowerCase();
  const expected = `Route is not in ${from.join(" or ")} status`;
  try {
    await tx.$queryRaw`SELECT id FROM "Route" WHERE id = ${routeId}::uuid FOR UPDATE`;

    const route = await tx.route.findUnique({ where: { id: routeId } });

    if (!route) throw new NotFoundError("Route not found");
    if (!from.includes(route.status)) throw new ConflictError(expected);
    const driverRow = await tx.user.findUnique({
      where: { id: driverId },
      include: userInclude,
    });
    const vehicleRow = await tx.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!driverRow || !hasUserType(driverRow, "Driver"))
      throw new InvalidAssignmentError("Driver not found or not a driver");
    if (driverRow.status === "archived")
      throw new InvalidAssignmentError(
        "Driver is archived and cannot be assigned",
      );
    if (!vehicleRow) throw new InvalidAssignmentError("Vehicle not found");
    if (vehicleRow.status === "archived")
      throw new InvalidAssignmentError(
        "Vehicle is archived and cannot be assigned",
      );
    const driver = driverRow;
    const startTime = estTimeStr(route.scheduledPickupTime);
    const day = estDayOfWeek(route.scheduledPickupTime);
    if (
      !driver.shifts?.some(
        (shift) =>
          shift.dayOfWeek === day &&
          shift.startTime <= startTime &&
          startTime <= shift.endTime,
      )
    )
      throw new AssignmentUnavailableError(
        "Driver is not available during the scheduled time",
      );
    const conflicts = await findBookingConflicts(
      routeId,
      driverId,
      vehicleId,
      tx,
    );
    if (conflicts.length) throw new BookingConflictError(conflicts);
    const { count } = await tx.route.updateMany({
      where: { id: routeId, status: { in: from } },
      data: {
        driverId,
        vehicleId,
        // Assignment changes do not resolve a pending itinerary review.
        status:
          route.status === RouteStatus.ActionRequiredByAdmin ||
          route.status === RouteStatus.ActionRequiredByStudent
            ? route.status
            : RouteStatus.Scheduled,
      },
    });
    if (count === 0) {
      const current = await tx.route.findUnique({
        where: { id: routeId },
        select: { id: true },
      });
      if (!current) throw new NotFoundError("Route not found");
      throw new ConflictError(expected);
    }
    const updated = await tx.route.findUniqueOrThrow({
      where: { id: routeId },
      include: adminRouteInclude,
    });
    if (audit)
      await recordAudit(tx, {
        actorId,
        entityType: "Route",
        entityId: updated.id,
        action: "Update",
        before: routeAuditSnapshot(route),
        after: routeAuditSnapshot(updated),
      });
    // A reassignment leaves the previous driver to be told they are off the
    // ride; an unchanged save should notify nobody at all.
    const priorDriverId = route.driverId?.toLowerCase() ?? null;
    const previousDriver =
      priorDriverId && priorDriverId !== driverId
        ? await tx.user.findUnique({
            where: { id: priorDriverId },
            include: userInclude,
          })
        : null;
    const unchanged =
      priorDriverId === driverId &&
      route.vehicleId?.toLowerCase() === vehicleId;
    return { route: updated, driver, priorDriverId, previousDriver, unchanged };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    )
      throw new ArgumentError("Referenced driver or vehicle not found");
    throw error;
  }
}

export async function transitionRoute(
  routeId: string,
  expected: RouteStatus[],
  status: RouteStatus,
  actorId: string,
  /** Transaction callers publish events and notifications after committing. */
  options?: { notify?: boolean; tx?: Prisma.TransactionClient },
) {
  routeId = routeId.toLowerCase();
  const update = async (tx: Prisma.TransactionClient) => {
    const before = await tx.route.findUnique({ where: { id: routeId } });
    if (!before) throw new NotFoundError("Route not found");
    const { count } = await tx.route.updateMany({
      where: {
        id: routeId,
        status: { in: expected },
      },
      data: { status: status },
    });
    if (count === 0) {
      const current = await tx.route.findUnique({
        where: { id: routeId },
        select: { id: true },
      });
      if (!current) throw new NotFoundError("Route not found");
      throw new ConflictError("Route is in an incompatible state");
    }
    if (
      status === RouteStatus.CancelledByStudent ||
      status === RouteStatus.CancelledByAdmin
    ) {
      const pending = await tx.proposedRideChange.findUnique({
        where: { routeId },
      });
      if (pending)
        await resolveProposedRideChange(tx, pending, "Cancelled", actorId);
    }
    const updated = await tx.route.findUniqueOrThrow({
      where: { id: routeId },
      include: adminRouteInclude,
    });
    await recordAudit(tx, {
      actorId,
      entityType: "Route",
      entityId: updated.id,
      action: "Update",
      before: routeAuditSnapshot(before),
      after: routeAuditSnapshot(updated),
    });
    return updated;
  };
  const route = options?.tx
    ? await update(options.tx)
    : await db.$transaction(update);
  if (!options?.tx) {
    emitRouteUpdate(route);
    if (options?.notify !== false) void notifyRideStatusChanged(route);
  }

  return route;
}

/** Proposals never overwrite the approved itinerary. Reviews serialize with scheduling. */
export async function editOrAcceptRoute(
  routeId: string,
  actor: { userId: string; activeType: UserType },
  input: EditRouteInput | null,
  review?: { action: "accept" | "decline"; changeId: string },
) {
  routeId = routeId.toLowerCase();

  const initial = await db.route.findUnique({
    where: { id: routeId },
    include: { driver: { include: userInclude } },
  });

  if (!initial) throw new NotFoundError("Route not found");

  const admin = isAdmin(actor.activeType);

  if (
    !admin &&
    (actor.activeType !== "Student" || initial.studentId !== actor.userId)
  )
    throw new HttpError(HTTP_STATUS_CODE.FORBIDDEN, "Forbidden");

  const accepting = !input && review?.action === "accept";

  const keys =
    initial.driverId && initial.vehicleId
      ? schedulingLockKeys([
          { driverId: initial.driverId, vehicleId: initial.vehicleId },
        ])
      : [];

  const persist = async (tx: Prisma.TransactionClient) => {
    await tx.$queryRaw`SELECT id FROM "Route" WHERE id = ${routeId}::uuid FOR UPDATE`;

    const before = await tx.route.findUniqueOrThrow({
      where: { id: routeId },
    });

    if (
      before.driverId !== initial.driverId ||
      before.vehicleId !== initial.vehicleId
    )
      throw new ConflictError(
        "The ride assignment changed. Reload and try again.",
      );

    if (!EDITABLE_RIDE_STATUSES.has(before.status))
      throw new ConflictError("This ride can no longer be edited or reviewed.");

    const pending = await tx.proposedRideChange.findUnique({
      where: { routeId },
    });

    let status: RouteStatus;

    if (input) {
      input = {
        ...input,
        pickupLocation: input.pickupLocation.toLowerCase(),
        dropoffLocation: input.dropoffLocation.toLowerCase(),
      };
      validateRideEdit(input, before.scheduledPickupTime, admin);

      const [pickup, dropoff] = await Promise.all([
        tx.location.findUnique({ where: { id: input.pickupLocation } }),
        tx.location.findUnique({ where: { id: input.dropoffLocation } }),
      ]);

      if (
        !pickup ||
        !dropoff ||
        pickup.status !== "active" ||
        dropoff.status !== "active"
      )
        throw new ArgumentError("Choose active pickup and dropoff locations.");

      if (
        input.pickupLocation === before.pickupLocation &&
        input.dropoffLocation === before.dropoffLocation &&
        input.scheduledPickupTime.getTime() ===
          before.scheduledPickupTime.getTime() &&
        input.pickupWindowStart.getTime() ===
          before.pickupWindowStart.getTime() &&
        input.pickupWindowEnd.getTime() === before.pickupWindowEnd.getTime()
      )
        throw new ArgumentError(
          "Change at least one ride detail before requesting an edit.",
        );

      const seconds = await getMapboxTravelDuration(
        pickup.latitude,
        pickup.longitude,
        dropoff.latitude,
        dropoff.longitude,
        input.scheduledPickupTime,
      );

      // Replacing a proposal preserves its history and invalidates stale review pages.
      if (pending)
        await resolveProposedRideChange(
          tx,
          pending,
          "Superseded",
          actor.userId,
        );

      const change = await tx.proposedRideChange.create({
        data: {
          routeId,
          requestedById: actor.userId,
          requestedByRole: actor.activeType,
          pickupLocation: input.pickupLocation,
          dropoffLocation: input.dropoffLocation,
          scheduledPickupTime: input.scheduledPickupTime,
          pickupWindowStart: input.pickupWindowStart,
          pickupWindowEnd: input.pickupWindowEnd,
          estimatedDropoffTime:
            seconds === null
              ? null
              : new Date(input.scheduledPickupTime.getTime() + seconds * 1000),
        },
      });

      await recordAudit(tx, {
        actorId: actor.userId,
        entityType: "ProposedRideChange",
        entityId: change.id,
        action: "Create",
        after: change,
      });
      status = admin
        ? RouteStatus.ActionRequiredByStudent
        : RouteStatus.ActionRequiredByAdmin;
    } else {
      const expected = admin
        ? RouteStatus.ActionRequiredByAdmin
        : RouteStatus.ActionRequiredByStudent;

      if (before.status !== expected)
        throw new ConflictError("This ride is not awaiting your review.");

      if (!pending || !review || review.changeId.toLowerCase() !== pending.id)
        throw new ConflictError(
          "This request has changed. Reload before reviewing it.",
        );

      if (review.action === "decline") {
        await resolveProposedRideChange(tx, pending, "Declined", actor.userId);
        status = admin
          ? RouteStatus.CancelledByAdmin
          : RouteStatus.CancelledByStudent;
      } else {
        const proposed = {
          pickupLocation: pending.pickupLocation,
          dropoffLocation: pending.dropoffLocation,
          scheduledPickupTime: pending.scheduledPickupTime,
          pickupWindowStart: pending.pickupWindowStart,
          pickupWindowEnd: pending.pickupWindowEnd,
        };

        // Acceptance is permitted within three hours, but never after the proposed pickup.
        validateRideEdit(proposed, before.scheduledPickupTime, true);

        const locations = await tx.location.count({
          where: {
            id: { in: [proposed.pickupLocation, proposed.dropoffLocation] },
            status: "active",
          },
        });

        if (locations !== 2)
          throw new ConflictError(
            "A proposed location is no longer active. Edit the request before accepting.",
          );

        // Requested is temporary inside this transaction so the scheduling validator sees the proposal.
        await tx.route.update({
          where: { id: routeId },
          data: {
            ...proposed,
            estimatedDropoffTime: pending.estimatedDropoffTime,
            delayMinutes: 0,
            status: RouteStatus.Requested,
          },
        });

        const candidate =
          before.driverId && before.vehicleId
            ? { driverId: before.driverId, vehicleId: before.vehicleId }
            : null;

        status = RouteStatus.Requested;

        if (candidate) {
          try {
            await assignRoute(
              routeId,
              candidate.driverId,
              candidate.vehicleId,
              tx,
              actor.userId,
              [RouteStatus.Requested],
              false,
            );

            status = RouteStatus.Scheduled;
          } catch (error) {
            // A stale existing assignment must not block an otherwise valid approval.
            if (!(
              error instanceof BookingConflictError ||
              error instanceof AssignmentUnavailableError ||
              error instanceof InvalidAssignmentError
            ))
              throw error;
          }
        }

        if (status === RouteStatus.Requested)
          await tx.route.update({
            where: { id: routeId },
            data: { driverId: null, vehicleId: null },
          });

        await resolveProposedRideChange(tx, pending, "Accepted", actor.userId);
      }
    }

    const route = await tx.route.update({
      where: { id: routeId },
      data: { status },
      include: adminRouteInclude,
    });

    await recordAudit(tx, {
      actorId: actor.userId,
      entityType: "Route",
      entityId: routeId,
      action: "Update",
      before: routeAuditSnapshot(before),
      after: routeAuditSnapshot(route),
    });

    return route;
  };

  const updated = await (
    accepting
      ? withSchedulingLock(keys, persist)
      : db.$transaction(persist, { timeout: 60_000 })
  ).catch((error) => {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictError("You already have a ride at that pickup time.");
    throw error;
  });

  emitRouteUpdate(updated, initial.driverId ? [initial.driverId] : []);

  if (accepting) void notifyRideChangesAccepted(updated, initial.driver);
  else void notifyRideStatusChanged(updated);

  return updated;
}

function validateRideEdit(
  input: EditRouteInput,
  approvedPickup: Date,
  admin: boolean,
) {
  const now = Date.now();

  const notice = STUDENT_EDIT_MIN_NOTICE_HOURS * 60 * 60 * 1000;

  if (
    !admin &&
    (approvedPickup.getTime() - now <= notice ||
      input.scheduledPickupTime.getTime() - now <= notice)
  )
    throw new ConflictError(
      `Student edits require more than ${STUDENT_EDIT_MIN_NOTICE_HOURS} hours before pickup.`,
    );

  if (estDateKey(input.scheduledPickupTime) !== estDateKey(approvedPickup))
    throw new ArgumentError(
      "The ride date cannot be changed. Request a new ride for a different date.",
    );

  if (input.scheduledPickupTime.getTime() <= now)
    throw new ArgumentError("Pickup time must be in the future.");

  const start = input.pickupWindowStart;

  const end = input.pickupWindowEnd;

  if (
    start >= end ||
    start > input.scheduledPickupTime ||
    end < input.scheduledPickupTime ||
    input.scheduledPickupTime.getTime() - start.getTime() > 45 * 60_000 ||
    end.getTime() - input.scheduledPickupTime.getTime() > 45 * 60_000 ||
    [start, end].some(
      (d) =>
        estDateKey(d) !== estDateKey(input.scheduledPickupTime) ||
        estTimeStr(d) < SERVICE_START_TIME ||
        estTimeStr(d) > SERVICE_END_TIME,
    )
  )
    throw new ArgumentError(
      "Pickup must fall within a service-hours window extending at most 45 minutes on either side.",
    );

  if (input.pickupLocation === input.dropoffLocation)
    throw new ArgumentError("Pickup and dropoff locations must differ.");
}

async function resolveProposedRideChange(
  tx: Prisma.TransactionClient,
  before: Prisma.ProposedRideChangeGetPayload<object>,
  outcome: "Accepted" | "Declined" | "Superseded" | "Cancelled",
  actorId: string,
) {
  await tx.proposedRideChange.delete({ where: { id: before.id } });

  await recordAudit(tx, {
    actorId,
    entityType: "ProposedRideChange",
    entityId: before.id,
    action: "Delete",
    before,
    after: {
      routeId: before.routeId,
      outcome,
      reviewedById: actorId,
      reviewedAt: new Date(),
    },
  });
}
