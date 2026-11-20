import type loadHighs from "highs";

import {
  isPickupInServiceHours,
  SERVICE_HOURS_LABEL,
} from "@/utils/rideTiming";
import {
  areRidesCompatible,
  rideTouchesDay,
  shiftsCoverRide,
} from "@/utils/rideScheduling";

import type { DayData } from "./loadDay";
import {
  type Assignment,
  AutoScheduleConflictError,
  indexBusy,
  validateAssignments,
} from "./conflicts";

type AssignmentCandidate = {
  name: string;
  ride: number;
  driver: number;
  vehicle: number;
};

// Assigning a ride dominates everything; the smaller weights only break ties.
const RIDE_WEIGHT = 1000;
const NEW_DRIVER_VEHICLE_PAIR_COST = 1;
const ACCESSIBLE_VEHICLE_MISUSE_COST = 0.1;

let highsPromise: ReturnType<typeof loadHighs> | null = null;

function getHighs() {
  highsPromise ??= import("highs").then((m) => m.default());

  return highsPromise;
}

/**
 * Build and solve one binary variable per feasible ride/driver/vehicle triple.
 * Fixed assignments restrict the model to exactly those assignments, making
 * the same model a feasibility check for draft edits and booking.
 */
export async function solveDay(data: DayData, fixed?: Assignment[]) {
  const { drivers, vehicles, requested, busy } = data;
  const fixedKeys = fixed
    ? new Set(fixed.map((f) => `${f.rideId}|${f.driverId}|${f.vehicleId}`))
    : null;

  const { byDriver: busyByDriver, byVehicle: busyByVehicle } = indexBusy(busy);
  const busyToday = busy.filter(rideTouchesDay);
  const pairsInUse = new Set(
    busyToday.flatMap((r) =>
      r.driverId && r.vehicleId ? [`${r.driverId}|${r.vehicleId}`] : [],
    ),
  );

  const candidates: AssignmentCandidate[] = [];
  const reasons = new Map<string, string>();

  requested.forEach((ride, rideIndex) => {
    const onShift = drivers
      .map((driver, driverIndex) => ({ driver, driverIndex }))
      .filter(
        ({ driver }) => driver.active && shiftsCoverRide(driver.shifts, ride),
      );
    const freeDrivers = onShift.filter(({ driver }) =>
      (busyByDriver.get(driver.id) ?? []).every((b) =>
        areRidesCompatible(b, ride),
      ),
    );
    const suitableVehicles = vehicles
      .map((vehicle, vehicleIndex) => ({ vehicle, vehicleIndex }))
      .filter(({ vehicle }) => !ride.needsWheelchair || vehicle.wheelchair);
    const freeVehicles = suitableVehicles.filter(({ vehicle }) =>
      (busyByVehicle.get(vehicle.id) ?? []).every((b) =>
        areRidesCompatible(b, ride),
      ),
    );

    if (!isPickupInServiceHours(ride.start)) {
      reasons.set(
        ride.id,
        `Pickup is outside service hours (${SERVICE_HOURS_LABEL})`,
      );

      return;
    }

    if (!onShift.length) {
      reasons.set(ride.id, "No driver is on shift for the whole ride");
    } else if (!freeDrivers.length) {
      reasons.set(ride.id, "Every on-shift driver already has a ride then");
    } else if (!suitableVehicles.length) {
      reasons.set(ride.id, "Needs a wheelchair vehicle, and none exist");
    } else if (!freeVehicles.length) {
      reasons.set(ride.id, "Every suitable vehicle is already in use then");
    } else {
      reasons.set(
        ride.id,
        "Overlaps other rides; not enough drivers or vehicles for all of them",
      );
    }

    for (const { driver, driverIndex } of freeDrivers) {
      for (const { vehicle, vehicleIndex } of freeVehicles) {
        if (
          fixedKeys &&
          !fixedKeys.has(`${ride.id}|${driver.id}|${vehicle.id}`)
        ) {
          continue;
        }

        candidates.push({
          name: `x_${rideIndex}_${driverIndex}_${vehicleIndex}`,
          ride: rideIndex,
          driver: driverIndex,
          vehicle: vehicleIndex,
        });
      }
    }
  });

  if (fixed) {
    validateAssignments(fixed, {
      requested,
      busy,
      drivers,
      vehicles,
      candidates,
      busyByDriver,
      busyByVehicle,
    });
  }

  const objective: string[] = [];
  const constraints: string[] = [];
  const pairVars = new Map<string, AssignmentCandidate[]>();
  const byRideDriver = new Map<string, string[]>();
  const byRideVehicle = new Map<string, string[]>();
  const appendVariableName = (
    index: Map<string, string[]>,
    key: string,
    name: string,
  ) => {
    index.set(key, [...(index.get(key) ?? []), name]);
  };

  for (const candidate of candidates) {
    const ride = requested[candidate.ride];
    const misuse =
      vehicles[candidate.vehicle].wheelchair && !ride.needsWheelchair
        ? ACCESSIBLE_VEHICLE_MISUSE_COST
        : 0;
    objective.push(`+ ${RIDE_WEIGHT - misuse} ${candidate.name}`);
    appendVariableName(
      byRideDriver,
      `${candidate.ride}|${candidate.driver}`,
      candidate.name,
    );
    appendVariableName(
      byRideVehicle,
      `${candidate.ride}|${candidate.vehicle}`,
      candidate.name,
    );
    const pairKey = `${candidate.driver}|${candidate.vehicle}`;
    pairVars.set(pairKey, [...(pairVars.get(pairKey) ?? []), candidate]);
  }

  // Each ride gets at most one driver/vehicle (exactly one when validating).
  requested.forEach((_, rideIndex) => {
    const names = candidates
      .filter((candidate) => candidate.ride === rideIndex)
      .map((candidate) => candidate.name);

    if (names.length) {
      constraints.push(`${names.join(" + ")} ${fixed ? "=" : "<="} 1`);
    }
  });

  // No driver or vehicle takes two rides that overlap once turnaround is added.
  for (let i = 0; i < requested.length; i++) {
    for (let j = i + 1; j < requested.length; j++) {
      if (areRidesCompatible(requested[i], requested[j])) {
        continue;
      }

      drivers.forEach((_, driverIndex) => {
        const names = [
          ...(byRideDriver.get(`${i}|${driverIndex}`) ?? []),
          ...(byRideDriver.get(`${j}|${driverIndex}`) ?? []),
        ];

        if (names.length > 1) {
          constraints.push(`${names.join(" + ")} <= 1`);
        }
      });
      vehicles.forEach((_, vehicleIndex) => {
        const names = [
          ...(byRideVehicle.get(`${i}|${vehicleIndex}`) ?? []),
          ...(byRideVehicle.get(`${j}|${vehicleIndex}`) ?? []),
        ];

        if (names.length > 1) {
          constraints.push(`${names.join(" + ")} <= 1`);
        }
      });
    }
  }

  // Prefer keeping each driver in the same vehicle across the day.
  const pairNames: string[] = [];
  for (const [pairKey, pairCandidates] of pairVars) {
    const [driverIndex, vehicleIndex] = pairKey.split("|").map(Number);
    const pairName = `y_${driverIndex}_${vehicleIndex}`;
    pairNames.push(pairName);
    const cost = pairsInUse.has(
      `${drivers[driverIndex].id}|${vehicles[vehicleIndex].id}`,
    )
      ? 0
      : NEW_DRIVER_VEHICLE_PAIR_COST;

    if (cost) {
      objective.push(`- ${cost} ${pairName}`);
    }

    constraints.push(
      `${pairCandidates.map((candidate) => candidate.name).join(" + ")} - ${pairCandidates.length} ${pairName} <= 0`,
    );
  }

  let solverStatus = "Empty";
  const chosen = new Set<string>();

  if (candidates.length) {
    // One term per line keeps rows under the LP reader's line-length limit.
    const lp = [
      "Maximize",
      ` obj: ${objective.join("\n ")}`,
      "Subject To",
      ...constraints.map((c, k) => ` c${k}: ${c.split(" + ").join("\n + ")}`),
      "Binary",
      ...[...candidates.map((candidate) => candidate.name), ...pairNames].map(
        (n) => ` ${n}`,
      ),
      "End",
    ].join("\n");
    const result = (await getHighs()).solve(lp, {
      output_flag: false,
      time_limit: 20,
    });
    solverStatus = result.Status;
    if (fixed && result.Status !== "Optimal") {
      throw new AutoScheduleConflictError(
        `The solver could not confirm these assignments (status: ${result.Status}). Regenerate the schedule.`,
      );
    }

    for (const candidate of candidates) {
      const col = result.Columns[candidate.name];

      if (col && "Primal" in col && col.Primal > 0.5) {
        chosen.add(candidate.name);
      }
    }
  }

  const assignments = candidates
    .filter((candidate) => chosen.has(candidate.name))
    .map((candidate) => ({
      rideId: requested[candidate.ride].id,
      driverId: drivers[candidate.driver].id,
      vehicleId: vehicles[candidate.vehicle].id,
    }));

  return { assignments, reasons, solverStatus };
}
