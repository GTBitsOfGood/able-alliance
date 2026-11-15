import { areRidesCompatible, rideTouchesDay } from "@/utils/rideScheduling";
import type { Ride, AutoSchedulePlan } from "@/types/autoSchedule";
import { db } from "@db";
import type { Prisma } from "@db/generated/client";

import { loadDay } from "./loadDay";
import { type Assignment, indexBusy } from "./conflicts";
import { solveDay } from "./solveDay";

/** Load a day, solve or validate assignments, and build its schedule overview. */
export async function planDay(
  date: string,
  fixed?: Assignment[],
  client: Prisma.TransactionClient = db,
): Promise<AutoSchedulePlan> {
  const data = await loadDay(date, client);
  const { drivers, vehicles, requested, busy } = data;
  const { assignments, reasons, solverStatus } = await solveDay(data, fixed);
  const assignedRides = new Set(assignments.map((a) => a.rideId));
  const busyToday = busy.filter(rideTouchesDay);
  const shownByDriver = indexBusy(busyToday).byDriver;

  const doubleBookings: AutoSchedulePlan["doubleBookings"] = [];
  const findOverlaps = (
    resource: "driver" | "vehicle",
    byResource: Map<string, Ride[]>,
    nameOf: (id: string) => string,
  ) => {
    for (const [id, rides] of byResource) {
      for (let i = 0; i < rides.length; i++) {
        for (let j = i + 1; j < rides.length; j++) {
          if (!areRidesCompatible(rides[i], rides[j])) {
            doubleBookings.push({
              resource,
              name: nameOf(id),
              rides: [rides[i], rides[j]].sort((a, b) => a.start - b.start) as [
                Ride,
                Ride,
              ],
            });
          }
        }
      }
    }
  };

  const shownByVehicle = indexBusy(busyToday).byVehicle;
  findOverlaps(
    "driver",
    shownByDriver,
    (id) => drivers.find((d) => d.id === id)?.name ?? "Unknown driver",
  );
  findOverlaps(
    "vehicle",
    shownByVehicle,
    (id) =>
      vehicles.find((v) => v.id === id)?.label ??
      busy.find((r) => r.vehicleId === id)?.vehicleLabel ??
      "Unknown vehicle",
  );

  const offShiftBookings = busyToday.flatMap((ride) => {
    if (ride.start < 0) {
      return [];
    }

    const d = drivers.find((dd) => dd.id === ride.driverId);

    if (
      !d ||
      d.shifts.some((s) => s.start <= ride.start && ride.end <= s.end)
    ) {
      return [];
    }

    return [{ driverName: d.name, shifts: d.shifts, ride }];
  });

  return {
    doubleBookings,
    offShiftBookings,
    date,
    solverStatus,
    drivers: drivers.map((d) => ({
      _id: d.id,
      name: d.name,
      shifts: d.shifts,
      rides: [
        ...(shownByDriver.get(d.id) ?? []).map((r) => ({
          ...r,
          kind: "existing" as const,
        })),
        ...assignments
          .filter((a) => a.driverId === d.id)
          .map((a) => {
            const r = requested.find((rr) => rr.id === a.rideId)!;
            const v = vehicles.find((vv) => vv.id === a.vehicleId)!;

            return {
              ...r,
              driverId: d.id,
              vehicleId: v.id,
              vehicleLabel: v.label,
              kind: "proposed" as const,
            };
          }),
      ].sort((a, b) => a.start - b.start),
    })),
    assignments,
    unassigned: requested
      .filter((r) => !assignedRides.has(r.id))
      .map((r) => ({ ...r, reason: reasons.get(r.id) ?? "" })),
  };
}
