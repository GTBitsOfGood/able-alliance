import {
  formatMinutes,
  isPickupInServiceHours,
  SERVICE_HOURS_LABEL,
} from "@/utils/rideTiming";
import { areRidesCompatible } from "@/utils/rideScheduling";
import type { AutoSchedulePlan, Ride } from "@/types/autoSchedule";

import type { DayData } from "./loadDay";

export type Assignment = AutoSchedulePlan["assignments"][number];

type AssignmentContext = DayData & {
  candidates: { ride: number; driver: number; vehicle: number }[];
  busyByDriver: Map<string, Ride[]>;
  busyByVehicle: Map<string, Ride[]>;
};

export class AutoScheduleConflictError extends Error {
  constructor(
    message: string,
    public details: string[] = [],
  ) {
    super(message);
  }
}

export function indexBusy(busy: Ride[]) {
  const byDriver = new Map<string, Ride[]>();
  const byVehicle = new Map<string, Ride[]>();
  for (const r of busy) {
    if (r.driverId) {
      byDriver.set(r.driverId, [...(byDriver.get(r.driverId) ?? []), r]);
    }

    if (r.vehicleId) {
      byVehicle.set(r.vehicleId, [...(byVehicle.get(r.vehicleId) ?? []), r]);
    }
  }

  return { byDriver, byVehicle };
}

/** Overlap and accessibility problems with booking `ride` on a driver and vehicle. */
export function bookingProblems(
  ride: Ride,
  driver: { id: string; name: string },
  vehicle: { id: string; label: string; wheelchair: boolean },
  busyByDriver: Map<string, Ride[]>,
  busyByVehicle: Map<string, Ride[]>,
): string[] {
  const problems: string[] = [];
  const driverClash = (busyByDriver.get(driver.id) ?? []).find(
    (b) => b.id !== ride.id && !areRidesCompatible(b, ride),
  );

  if (driverClash) {
    problems.push(
      `${driver.name} is already driving ${driverClash.studentName} at ${formatMinutes(driverClash.start)}.`,
    );
  }

  if (ride.needsWheelchair && !vehicle.wheelchair) {
    problems.push(`Vehicle ${vehicle.label} is not wheelchair-accessible.`);
  }

  const vehicleClash = (busyByVehicle.get(vehicle.id) ?? []).find(
    (b) => b.id !== ride.id && !areRidesCompatible(b, ride),
  );

  if (vehicleClash) {
    problems.push(
      `Vehicle ${vehicle.label} is already in use for ${vehicleClash.studentName} at ${formatMinutes(vehicleClash.start)}.`,
    );
  }

  return problems;
}

/** Explains, in admin-facing terms, why a submitted assignment is not allowed. */
function diagnoseAssignment(
  assignment: { rideId: string; driverId: string; vehicleId: string },
  context: AssignmentContext,
): string[] {
  const rideIndex = context.requested.findIndex(
    (r) => r.id === assignment.rideId,
  );

  if (rideIndex === -1) {
    const booked = context.busy.find((r) => r.id === assignment.rideId);
    const bookedWith = context.drivers.find(
      (driver) => driver.id === booked?.driverId,
    )?.name;

    return [
      booked
        ? `${booked.studentName} (${formatMinutes(booked.start)}) is already booked${bookedWith ? ` with ${bookedWith}` : ""}.`
        : `Ride ${assignment.rideId} is no longer requested on this day; it may have been cancelled or moved.`,
    ];
  }

  const ride = context.requested[rideIndex];
  const driverIndex = context.drivers.findIndex(
    (driver) => driver.id === assignment.driverId,
  );
  const vehicleIndex = context.vehicles.findIndex(
    (vehicle) => vehicle.id === assignment.vehicleId,
  );

  if (
    context.candidates.some(
      (x) =>
        x.ride === rideIndex &&
        x.driver === driverIndex &&
        x.vehicle === vehicleIndex,
    )
  ) {
    return [];
  }

  const who = `${ride.studentName} (${formatMinutes(ride.start)})`;

  if (driverIndex === -1) {
    return [`${who}: the driver no longer exists or has no shift today.`];
  }

  if (vehicleIndex === -1) {
    return [`${who}: the vehicle no longer exists.`];
  }

  const driver = context.drivers[driverIndex];
  const vehicle = context.vehicles[vehicleIndex];
  const problems: string[] = [];

  if (!isPickupInServiceHours(ride.start)) {
    problems.push(
      `${who}: pickup is outside service hours (${SERVICE_HOURS_LABEL}).`,
    );
  }

  if (!driver.shifts.some((s) => s.start <= ride.start && ride.end <= s.end)) {
    problems.push(
      `${who}: ${driver.name} is not on shift for the whole ride (${
        driver.shifts.length
          ? driver.shifts
              .map((s) => `${formatMinutes(s.start)}–${formatMinutes(s.end)}`)
              .join(", ")
          : "no shift today"
      }).`,
    );
  }

  for (const p of bookingProblems(
    ride,
    driver,
    vehicle,
    context.busyByDriver,
    context.busyByVehicle,
  )) {
    problems.push(`${who}: ${p}`);
  }

  return problems.length
    ? problems
    : [`${who}: assignment is no longer valid.`];
}

/** Reject stale or conflicting submitted assignments before solving or booking. */
export function validateAssignments(
  fixed: Assignment[],
  context: AssignmentContext,
) {
  const { requested, drivers, vehicles, candidates } = context;
  const problems = fixed.flatMap((f) => diagnoseAssignment(f, context));

  if (problems.length) {
    throw new AutoScheduleConflictError(
      `${problems.length} proposed ${problems.length === 1 ? "assignment is" : "assignments are"} no longer valid. Regenerate the schedule.`,
      problems,
    );
  }

  const clashes: string[] = [];
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const [firstCandidate, secondCandidate] = [candidates[i], candidates[j]];
      const [firstRide, secondRide] = [
        requested[firstCandidate.ride],
        requested[secondCandidate.ride],
      ];

      if (areRidesCompatible(firstRide, secondRide)) {
        continue;
      }

      if (firstCandidate.driver === secondCandidate.driver) {
        clashes.push(
          `${firstRide.studentName} (${formatMinutes(firstRide.start)}) and ${secondRide.studentName} (${formatMinutes(secondRide.start)}) would both be driven by ${drivers[firstCandidate.driver].name}`,
        );
      }

      if (firstCandidate.vehicle === secondCandidate.vehicle) {
        clashes.push(
          `${firstRide.studentName} (${formatMinutes(firstRide.start)}) and ${secondRide.studentName} (${formatMinutes(secondRide.start)}) would both use vehicle ${vehicles[firstCandidate.vehicle].label}`,
        );
      }
    }
  }

  if (clashes.length) {
    throw new AutoScheduleConflictError(
      "Proposed assignments overlap each other. Regenerate the schedule.",
      clashes,
    );
  }
}
