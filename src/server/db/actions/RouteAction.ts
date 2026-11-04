import { hasUserType } from "@/utils/userTypes";
import { findBookingConflicts } from "@/server/scheduling/autoSchedule";
import { db } from "@db";
import { Prisma, RouteStatus } from "@db/generated/client";
import type { UserType } from "@db/generated/browser";
import {
  userInclude,
  adminRouteInclude,
  studentRouteInclude,
  driverRouteInclude,
} from "@/server/db/queries";
import { isAdmin } from "@/utils/authUser";
import { createRouteSchema, type CreateRouteInput } from "@/utils/types";
import { ArgumentError, ConflictError, NotFoundError } from "@/utils/errors";
import { getMapboxTravelDuration } from "@/server/mapbox";
import {
  estDayOfWeek,
  estTimeStr,
  formatEstDate,
  formatEstTime,
} from "@/utils/dateEst";
import { EmailClient } from "@/server/email/EmailClient";
import { emitToast } from "@/server/notifications/emitToast";
import { emitRouteUpdate } from "@/server/notifications/emitRouteUpdate";
import { MAX_DELAY_MINUTES } from "@/utils/consts";
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

async function sendEmailSafely(label: string, send: () => Promise<void>) {
  try {
    await send();
  } catch (error) {
    console.error(`Failed to send ${label} email`, error);
  }
}

function dispatchNotifications(tasks: Promise<void>[]) {
  Promise.all(tasks).catch((error) => {
    console.error("Notification dispatch failed", error);
  });
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
        throw new ConflictError("Route has chat history and cannot be deleted");
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

export async function completeRoute(routeId: string, actorId: string) {
  const route = await transitionRoute(
    routeId,
    [RouteStatus.Pickedup],
    RouteStatus.Completed,
    actorId,
  );

  const studentUser = route.student;
  if (studentUser && studentUser.settings?.rideCompleted) {
    dispatchNotifications([
      sendEmailSafely("rideCompleted", () =>
        EmailClient.rideCompleted(
          studentUser.email,
          studentUser.preferredName ??
            `${studentUser.firstName} ${studentUser.lastName}`,
          {
            rideId: route.id.toString(),
          },
        ),
      ),
      emitToast(studentUser.id.toString(), {
        type: "success",
        message: "Your ride has been completed. Thank you for riding with us!",
      }),
    ]);
  }

  return route;
}
export async function cancelRoute(
  routeId: string,
  status:
    typeof RouteStatus.CancelledByStudent | typeof RouteStatus.CancelledByAdmin,
  actorId: string,
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
      RouteStatus.Scheduled,
      RouteStatus.EnRoute,
      RouteStatus.Pickedup,
    ],
    status,
    actorId,
  );
  const studentUser = route.student;
  if (studentUser && studentUser.settings?.rideCancelled) {
    dispatchNotifications([
      sendEmailSafely("rideCancelled", () =>
        EmailClient.rideCancelled(
          studentUser.email,
          studentUser.preferredName ??
            `${studentUser.firstName} ${studentUser.lastName}`,
          {
            rideId: route.id.toString(),
            reason: `Ride status: ${route.status}`,
          },
        ),
      ),
      emitToast(studentUser.id.toString(), {
        type: "error",
        message: "Your ride has been cancelled.",
      }),
    ]);
  }

  if (route.driver?.id) {
    const driverUser = route.driver;
    if (driverUser && driverUser.settings?.rideCancelled) {
      dispatchNotifications([
        sendEmailSafely("rideCancelled", () =>
          EmailClient.rideCancelled(
            driverUser.email,
            driverUser.preferredName ??
              `${driverUser.firstName} ${driverUser.lastName}`,
            {
              rideId: route.id.toString(),
              reason: `Ride status: ${route.status}`,
            },
          ),
        ),
        emitToast(driverUser.id.toString(), {
          type: "error",
          message: "Your ride has been cancelled.",
        }),
      ]);
    }
  }

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

  const shift = (date: Date) =>
    new Date(date.getTime() + route.delayMinutes * 60 * 1000);
  const tasks = [
    sendEmailSafely("rideDelayed", () =>
      EmailClient.rideDelayed(route.id, {
        delay: `${route.delayMinutes} minutes`,
        oldPickupTime: formatEstTime(route.scheduledPickupTime),
        newPickupTime: formatEstTime(shift(route.scheduledPickupTime)),
        oldDropoffTime: route.estimatedDropoffTime
          ? formatEstTime(route.estimatedDropoffTime)
          : "N/A",
        newDropoffTime: route.estimatedDropoffTime
          ? formatEstTime(shift(route.estimatedDropoffTime))
          : "N/A",
      }),
    ),
  ];
  if (route.student.settings?.rideDelayed) {
    tasks.push(
      emitToast(route.student.id.toString(), {
        type: "info",
        message: `Your ride has been delayed by ${route.delayMinutes} minutes.`,
      }),
    );
  }
  if (route.driver?.settings?.rideDelayed) {
    tasks.push(
      emitToast(route.driver.id, {
        type: "info",
        message: `Your student reported a delay of ${route.delayMinutes} minutes for their ride.`,
      }),
    );
  }
  dispatchNotifications(tasks);

  return route;
}

export async function startRoute(routeId: string, actorId: string) {
  const route = await transitionRoute(
    routeId,
    [RouteStatus.Scheduled],
    RouteStatus.EnRoute,
    actorId,
  );
  const studentUser = route.student;
  if (studentUser && studentUser.settings?.driverEnRoute) {
    dispatchNotifications([
      sendEmailSafely("driverEnRoute", () =>
        EmailClient.driverEnRoute(
          studentUser.email,
          studentUser.preferredName ??
            `${studentUser.firstName} ${studentUser.lastName}`,
          {
            name: route.driver
              ? `${route.driver.firstName} ${route.driver.lastName}`
              : "Driver",
            eta: formatEstTime(route.scheduledPickupTime),
            vehicle: route.vehicle?.licensePlate ?? "Assigned vehicle",
          },
        ),
      ),
      emitToast(studentUser.id.toString(), {
        type: "info",
        message: "Your driver is on the way!",
      }),
    ]);
  }

  return route;
}

export const pickupStudent = (routeId: string, actorId: string) =>
  transitionRoute(
    routeId,
    [RouteStatus.EnRoute],
    RouteStatus.Pickedup,
    actorId,
  );

export const markRouteMissing = (routeId: string, actorId: string) =>
  transitionRoute(
    routeId,
    [RouteStatus.Scheduled, RouteStatus.EnRoute],
    RouteStatus.Missing,
    actorId,
  );

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

export class BookingConflictError extends ConflictError {
  constructor(readonly details: string[]) {
    super(
      "This assignment conflicts with existing bookings or accessibility requirements.",
    );
  }
}

/**
 * `from` lists the statuses the ride may be assigned out of. It defaults to
 * Requested — the first assignment. Admins reassigning an already-scheduled
 * ride pass Scheduled as well; bulk and automatic scheduling keep the default
 * so they can never touch a ride an admin has already placed.
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
  const { route, driver, priorDriverId, previousDriver, unchanged } = assigned;
  afterCommit.push(() => {
    emitRouteUpdate(route);

    // Saving the same driver and vehicle changes nothing worth announcing.
    if (unchanged) return;

    const driverName = `${driver.firstName} ${driver.lastName}`;
    const rideTime = `${formatEstDate(route.scheduledPickupTime)} ${formatEstTime(route.scheduledPickupTime)}`;
    // Null before the first assignment; set when an admin swaps the driver.
    const driverChanged = previousDriver != null;
    // Everything else is a vehicle swap that leaves the driver in place.
    const vehicleOnly = priorDriverId != null && !driverChanged;

    // The driver who lost the ride hears about it too. There is no email
    // template for a reassignment yet, so this one is in-app only.
    if (driverChanged && previousDriver.settings?.rideAssigned) {
      dispatchNotifications([
        emitToast(previousDriver.id.toString(), {
          type: "warn",
          message: `Your ${rideTime} ride has been reassigned to another driver.`,
        }),
      ]);
    }

    const studentUser = route.student;
    if (studentUser?.settings?.driverAssigned) {
      dispatchNotifications([
        ...(vehicleOnly
          ? []
          : [
              sendEmailSafely("rideConfirmed", () =>
                EmailClient.rideConfirmed(route.id.toString()),
              ),
            ]),
        emitToast(studentUser.id.toString(), {
          type: "success",
          message: vehicleOnly
            ? `The vehicle for your ${rideTime} ride has changed.`
            : driverChanged
              ? `Your driver for ${rideTime} is now ${driverName}.`
              : `Your driver ${driverName} has been assigned.`,
        }),
      ]);
    }

    if (driver.settings?.rideAssigned) {
      dispatchNotifications([
        ...(vehicleOnly
          ? []
          : [
              sendEmailSafely("rideAssigned", () =>
                EmailClient.rideAssigned(
                  driver.email,
                  driver.preferredName ?? driverName,
                  {
                    rideId: route.id.toString(),
                    pickup: route.pickupLocation.toString(),
                    dropoff: route.dropoffLocation.toString(),
                    time: rideTime,
                  },
                ),
              ),
            ]),
        emitToast(driver.id.toString(), {
          type: "info",
          message: vehicleOnly
            ? `The vehicle for your ${rideTime} ride has changed.`
            : "You have been assigned a new ride.",
        }),
      ]);
    }
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
) {
  routeId = routeId.toLowerCase();
  driverId = driverId.toLowerCase();
  vehicleId = vehicleId.toLowerCase();
  const expected = `Route is not in ${from.join(" or ")} status`;
  try {
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
      throw new ArgumentError("Driver not found or not a driver");
    if (driverRow.status === "archived")
      throw new ArgumentError("Driver is archived and cannot be assigned");
    if (!vehicleRow) throw new ArgumentError("Vehicle not found");
    if (vehicleRow.status === "archived")
      throw new ArgumentError("Vehicle is archived and cannot be assigned");
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
      throw new ConflictError(
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
        status: RouteStatus.Scheduled,
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
) {
  routeId = routeId.toLowerCase();
  const route = await db.$transaction(async (tx) => {
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
  });
  emitRouteUpdate(route);
  return route;
}
