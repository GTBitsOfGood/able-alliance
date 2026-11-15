import { estDateKey } from "@/utils/dateEst";
import { areRidesCompatible } from "@/utils/rideScheduling";
import { db } from "@db";
import type { Prisma } from "@db/generated/client";

import { loadDay } from "./loadDay";
import { bookingProblems, indexBusy } from "./conflicts";

/** Conflicts with the current bookings for a requested driver and vehicle. */
export async function findBookingConflicts(
  routeId: string,
  driverId: string,
  vehicleId: string,
  client: Prisma.TransactionClient = db,
): Promise<string[]> {
  const route = await client.route.findUnique({
    where: { id: routeId },
    select: { scheduledPickupTime: true },
  });

  if (!route) {
    return [];
  }

  const { drivers, vehicles, requested, busy } = await loadDay(
    estDateKey(route.scheduledPickupTime),
    client,
  );
  // Reassignment validates the approved itinerary even while a proposal is pending.
  const ride =
    requested.find((r) => r.id === routeId) ??
    busy.find((r) => r.id === routeId);
  const vehicle = vehicles.find((v) => v.id === vehicleId);

  if (!ride || !vehicle) {
    return [];
  }

  const driver = drivers.find((d) => d.id === driverId) ?? {
    id: driverId,
    name: "The driver",
  };
  const { byDriver, byVehicle } = indexBusy(busy);

  return bookingProblems(ride, driver, vehicle, byDriver, byVehicle);
}

/** Driver IDs on shift for the full ride and without an existing booking conflict. */
export async function getAvailableDriversForRoute(
  routeId: string,
  client: Prisma.TransactionClient = db,
): Promise<string[]> {
  routeId = routeId.toLowerCase();
  const route = await client.route.findUnique({
    where: { id: routeId },
    select: { scheduledPickupTime: true },
  });

  if (!route) {
    return [];
  }

  const { drivers, requested, busy } = await loadDay(
    estDateKey(route.scheduledPickupTime),
    client,
  );
  const ride =
    requested.find((candidate) => candidate.id === routeId) ??
    busy.find((candidate) => candidate.id === routeId);

  if (!ride) {
    return [];
  }

  const busyByDriver = indexBusy(busy).byDriver;

  return drivers
    .filter(
      (driver) =>
        driver.active &&
        driver.shifts.some(
          (shift) => shift.start <= ride.start && ride.end <= shift.end,
        ) &&
        (busyByDriver.get(driver.id) ?? []).every(
          (bookedRide) =>
            bookedRide.id === ride.id || areRidesCompatible(bookedRide, ride),
        ),
    )
    .map((driver) => driver.id);
}
