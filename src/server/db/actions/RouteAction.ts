import { db } from "@db";
import { Prisma, RouteStatus } from "@db/generated/client";
import {
  userInclude,
  routeInclude,
  routeResponseInclude,
} from "@/server/db/queries";
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

export async function createRoute(data: CreateRouteInput) {
  const parsed = createRouteSchema.parse(data);
  const input = {
    ...parsed,
    pickupLocation: parsed.pickupLocation.toLowerCase(),
    dropoffLocation: parsed.dropoffLocation.toLowerCase(),
    student: parsed.student.toLowerCase(),
  };
  const [pickup, dropoff, student] = await Promise.all([
    db.location.findUnique({ where: { id: input.pickupLocation } }),
    db.location.findUnique({ where: { id: input.dropoffLocation } }),
    db.user.findUnique({ where: { id: input.student } }),
  ]);
  if (!pickup) throw new ArgumentError("Pickup location not found");
  if (!dropoff) throw new ArgumentError("Dropoff location not found");
  if (!student) throw new ArgumentError("Student not found");
  if (student.type !== "Student")
    throw new ArgumentError("Referenced user is not a student");
  const existing = await db.route.findUnique({
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
  try {
    return await db.route.create({
      data: {
        pickupLocation: input.pickupLocation,
        dropoffLocation: input.dropoffLocation,
        scheduledPickupTime: input.scheduledPickupTime,
        pickupWindowStart: input.pickupWindowStart,
        pickupWindowEnd: input.pickupWindowEnd,
        studentId: student.id,
        status: RouteStatus.Requested,
        estimatedDropoffTime:
          seconds !== null
            ? new Date(input.scheduledPickupTime.getTime() + seconds * 1000)
            : undefined,
      },
      include: routeResponseInclude,
    });
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
export async function getRouteById(id: string, includeAdminDetails = false) {
  const where = { id: id.toLowerCase() };
  const route = includeAdminDetails
    ? await db.route.findUnique({ where, include: routeInclude })
    : await db.route.findUnique({ where, include: routeResponseInclude });
  if (!route) throw new NotFoundError("Route not found");
  return route;
}
export async function deleteRoute(id: string) {
  try {
    return await db.route.delete({
      where: { id: id.toLowerCase() },
      include: routeInclude,
    });
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
  filters?: {
    student?: string;
    driver?: string;
    vehicle?: string;
    status?: RouteStatus;
    start_time?: Date;
    end_time?: Date;
  },
  includeAdminDetails = false,
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

  return includeAdminDetails
    ? db.route.findMany({ include: routeInclude, where })
    : db.route.findMany({ include: routeResponseInclude, where });
}

export async function completeRoute(routeId: string) {
  const route = await transitionRoute(
    routeId,
    [RouteStatus.Pickedup],
    RouteStatus.Completed,
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
    | typeof RouteStatus.CancelledByStudent
    | typeof RouteStatus.CancelledByAdmin = RouteStatus.CancelledByStudent,
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

export async function startRoute(routeId: string) {
  const route = await transitionRoute(
    routeId,
    [RouteStatus.Scheduled],
    RouteStatus.EnRoute,
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

export const pickupStudent = (routeId: string) =>
  transitionRoute(routeId, [RouteStatus.EnRoute], RouteStatus.Pickedup);

export const markRouteMissing = (routeId: string) =>
  transitionRoute(
    routeId,
    [RouteStatus.Scheduled, RouteStatus.EnRoute],
    RouteStatus.Missing,
  );

export async function scheduleRoute(
  routeId: string,
  driverId: string,
  vehicleId: string,
) {
  const assigned = await assignRoute(routeId, driverId, vehicleId);
  const { route, driver } = assigned;

  const studentUser = route.student;
  if (studentUser?.settings?.driverAssigned) {
    dispatchNotifications([
      sendEmailSafely("rideConfirmed", () =>
        EmailClient.rideConfirmed(route.id.toString()),
      ),
      emitToast(studentUser.id.toString(), {
        type: "success",
        message: `Your driver ${driver.firstName} ${driver.lastName} has been assigned.`,
      }),
    ]);
  }

  if (driver.settings?.rideAssigned) {
    dispatchNotifications([
      sendEmailSafely("rideAssigned", () =>
        EmailClient.rideAssigned(
          driver.email,
          driver.preferredName ?? `${driver.firstName} ${driver.lastName}`,
          {
            rideId: route.id.toString(),
            pickup: route.pickupLocation.toString(),
            dropoff: route.dropoffLocation.toString(),
            time: `${formatEstDate(route.scheduledPickupTime)} ${formatEstTime(route.scheduledPickupTime)}`,
          },
        ),
      ),
      emitToast(driver.id.toString(), {
        type: "info",
        message: "You have been assigned a new ride.",
      }),
    ]);
  }

  return route;
}

/** Every assignment path uses this transaction, including bulk shift assignment. */
async function assignRoute(
  routeId: string,
  driverId: string,
  vehicleId: string,
) {
  routeId = routeId.toLowerCase();
  driverId = driverId.toLowerCase();
  vehicleId = vehicleId.toLowerCase();
  try {
    return await db.$transaction(async (tx) => {
      const route = await tx.route.findUnique({ where: { id: routeId } });
      if (!route) throw new NotFoundError("Route not found");
      if (route.status !== RouteStatus.Requested)
        throw new ConflictError("Route is no longer in Requested status");
      const driverRow = await tx.user.findUnique({
        where: { id: driverId },
        include: userInclude,
      });
      const vehicleRow = await tx.vehicle.findUnique({
        where: { id: vehicleId },
      });
      if (!driverRow || driverRow.type !== "Driver")
        throw new ArgumentError("Driver not found or not a driver");
      if (!vehicleRow) throw new ArgumentError("Vehicle not found");
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
      const { count } = await tx.route.updateMany({
        where: { id: routeId, status: RouteStatus.Requested },
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
        throw new ConflictError("Route is no longer in Requested status");
      }
      const updated = await tx.route.findUniqueOrThrow({
        where: { id: routeId },
        include: routeInclude,
      });
      return { route: updated, driver };
    });
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
) {
  routeId = routeId.toLowerCase();
  return db.$transaction(async (tx) => {
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
      include: routeInclude,
    });
    return updated;
  });
}
