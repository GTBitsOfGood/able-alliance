import { fromZonedTime, toZonedTime } from "date-fns-tz";

import {
  EST_TIME_ZONE,
  MILLISECONDS_PER_DAY,
  minutesFromEstDate,
} from "@/utils/dateEst";
import { timeToMinutes } from "@/utils/rideTiming";
import { estimateTravelMinutes } from "@/utils/rideScheduling";
import type { Ride } from "@/types/autoSchedule";
import { userTypeFilter } from "@/utils/userTypes";
import { db } from "@db";
import { RouteStatus, type Prisma } from "@db/generated/client";
import { adminRouteInclude } from "@/server/queries";

const WHEELCHAIR_BOARDING_MIN = 10;
const OTHER_ACCOMMODATION_BOARDING_MIN = 5;

const BUSY_STATUSES = [
  RouteStatus.ActionRequiredByAdmin,
  RouteStatus.ActionRequiredByStudent,
  RouteStatus.Scheduled,
  RouteStatus.EnRoute,
  RouteStatus.Arrived,
  RouteStatus.Pickedup,
];

export async function loadDay(
  date: string,
  client: Prisma.TransactionClient = db,
) {
  const dayStart = fromZonedTime(`${date}T00:00:00`, EST_TIME_ZONE);
  const dayEnd = fromZonedTime(`${date}T23:59:59.999`, EST_TIME_ZONE);
  const dayOfWeek = toZonedTime(dayStart, EST_TIME_ZONE).getDay();

  // Bookings from the neighbouring days can run across midnight into this one.
  const [vehicles, routes] = await Promise.all([
    client.vehicle.findMany({ where: { status: "active" } }),
    client.route.findMany({
      where: {
        OR: [
          {
            status: RouteStatus.Requested,
            scheduledPickupTime: { gte: dayStart, lte: dayEnd },
          },
          {
            status: { in: BUSY_STATUSES },
            scheduledPickupTime: {
              gte: new Date(dayStart.getTime() - MILLISECONDS_PER_DAY),
              lte: new Date(dayEnd.getTime() + MILLISECONDS_PER_DAY),
            },
          },
        ],
      },
      include: adminRouteInclude,
    }),
  ]);
  const bookedDriverIds = routes.flatMap((r) => r.driverId ?? []);
  const drivers = await client.user.findMany({
    where: {
      AND: [userTypeFilter("Driver")],
      OR: [
        { shifts: { some: { dayOfWeek } } },
        { id: { in: bookedDriverIds } },
      ],
    },
    include: { shifts: true },
  });

  const toRide = (r: (typeof routes)[number]): Ride => {
    const accommodations =
      r.student.studentInfo?.accessibilityNeeds.map((a) => a.label) ?? [];
    const needsWheelchair = accommodations.some((a) =>
      a.toLowerCase().includes("wheelchair"),
    );
    const boarding = accommodations.length
      ? needsWheelchair
        ? WHEELCHAIR_BOARDING_MIN
        : OTHER_ACCOMMODATION_BOARDING_MIN
      : 0;
    const delayMinutes = r.delayMinutes ?? 0;
    const start =
      minutesFromEstDate(r.scheduledPickupTime, date) + delayMinutes;
    const pickupLoc = r.pickup;
    const dropoffLoc = r.dropoff;
    const estimatedDropoff = r.estimatedDropoffTime
      ? minutesFromEstDate(r.estimatedDropoffTime, date) + delayMinutes
      : null;
    const busyUntil =
      estimatedDropoff ??
      start + estimateTravelMinutes(pickupLoc ?? null, dropoffLoc ?? null);

    return {
      id: r.id,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      accommodations,
      needsWheelchair,
      start,
      end: Math.max(busyUntil, start) + boarding,
      pickupWindowStart: minutesFromEstDate(r.pickupWindowStart, date),
      pickupWindowEnd: minutesFromEstDate(r.pickupWindowEnd, date),
      estimatedDropoff,
      pickup: pickupLoc ?? null,
      dropoff: dropoffLoc ?? null,
      pickupName: pickupLoc?.name ?? "",
      dropoffName: dropoffLoc?.name ?? "",
      driverId: r.driverId ?? undefined,
      vehicleId: r.vehicleId ?? undefined,
      vehicleLabel: r.vehicle?.vehicleId || r.vehicle?.name,
    };
  };

  const requested = routes
    .filter((r) => r.status === RouteStatus.Requested)
    .map(toRide)
    .sort((a, b) => a.start - b.start);
  const busy = routes
    .filter((r) => r.status !== RouteStatus.Requested)
    .map(toRide);

  return {
    drivers: drivers.map((d) => ({
      id: d.id,
      name: `${d.firstName} ${d.lastName}`,
      active: d.status === "active",
      shifts: (d.shifts ?? [])
        .filter((s) => s.dayOfWeek === dayOfWeek)
        .map((s) => ({
          start: timeToMinutes(s.startTime),
          end: timeToMinutes(s.endTime),
        })),
    })),
    vehicles: vehicles.map((v) => ({
      id: v.id,
      label: v.vehicleId || v.name,
      wheelchair: v.accessibility === "Wheelchair",
    })),
    requested,
    busy,
  };
}

export type DayData = Awaited<ReturnType<typeof loadDay>>;
