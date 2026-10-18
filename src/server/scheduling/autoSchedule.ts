import type loadHighs from "highs";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import connectMongoDB from "../db/mongodb";
import RouteModel, { RouteStatus } from "../db/models/RouteModel";
import { DriverModel, StudentModel } from "../db/models/UserModel";
import VehicleModel from "../db/models/VehicleModel";
import LocationModel from "../db/models/LocationModel";
import { SERVICE_END_TIME, SERVICE_START_TIME } from "@/utils/consts";

const TZ = "America/New_York";
const DAY_MIN = 24 * 60;
const DAY_MS = DAY_MIN * 60 * 1000;

// Minimum slack between rides for parking, unloading, and check-in.
const BASE_TURNAROUND_MIN = 5;
const WHEELCHAIR_BOARDING_MIN = 10;
const OTHER_ACCOMMODATION_BOARDING_MIN = 5;
// Straight-line distance to driving time between dropoff and next pickup.
const ROAD_FACTOR = 1.4;
const AVG_SPEED_KMH = 30;

// Assigning a ride dominates everything; the smaller weights only break ties.
const RIDE_WEIGHT = 1000;
const NEW_DRIVER_VEHICLE_PAIR_COST = 1;
const ACCESSIBLE_VEHICLE_MISUSE_COST = 0.1;

const BUSY_STATUSES = [
  RouteStatus.Scheduled,
  RouteStatus.EnRoute,
  RouteStatus.Pickedup,
];

type Point = { latitude: number; longitude: number };

type Ride = {
  id: string;
  studentName: string;
  accommodations: string[];
  needsWheelchair: boolean;
  start: number;
  // Busy-until time used for conflict checks only: dropoff + boarding. Without
  // a stored estimate the dropoff comes from the locations' distance.
  end: number;
  pickupWindowStart: number;
  pickupWindowEnd: number;
  estimatedDropoff: number | null; // stored estimate only, never derived
  pickup: Point | null;
  dropoff: Point | null;
  pickupName: string;
  dropoffName: string;
  driverId?: string;
  vehicleId?: string;
  vehicleLabel?: string;
};

export type TimelineRide = Ride & {
  kind: "existing" | "proposed";
};

export type AutoSchedulePlan = {
  date: string;
  solverStatus: string;
  drivers: {
    _id: string;
    name: string;
    shifts: { start: number; end: number }[];
    rides: TimelineRide[];
  }[];
  assignments: { rideId: string; driverId: string; vehicleId: string }[];
  unassigned: (Ride & { reason: string })[];
  // Pre-existing bookings that already overlap; the solver never creates these.
  doubleBookings: {
    resource: "driver" | "vehicle";
    name: string;
    rides: [Ride, Ride];
  }[];
  // Pre-existing bookings not fully inside any of their driver's shifts.
  offShiftBookings: {
    driverName: string;
    shifts: { start: number; end: number }[];
    ride: Ride;
  }[];
};

export class AutoScheduleConflictError extends Error {
  constructor(
    message: string,
    public details: string[] = [],
  ) {
    super(message);
  }
}

export function formatMinutes(min: number): string {
  const inDay = ((min % DAY_MIN) + DAY_MIN) % DAY_MIN;
  const h = Math.floor(inDay / 60);
  const label = `${h % 12 || 12}:${String(inDay % 60).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  return min < 0
    ? `${label} (prev day)`
    : min >= DAY_MIN
      ? `${label} (next day)`
      : label;
}

let highsPromise: ReturnType<typeof loadHighs> | null = null;
function getHighs() {
  highsPromise ??= import("highs").then((m) => m.default());
  return highsPromise;
}

function minutesFromDay(date: Date, day: string): number {
  const z = toZonedTime(date, TZ);
  const [y, m, d] = day.split("-").map(Number);
  const dayOffset = Math.round(
    (Date.UTC(z.getFullYear(), z.getMonth(), z.getDate()) -
      Date.UTC(y, m - 1, d)) /
      DAY_MS,
  );
  return dayOffset * DAY_MIN + z.getHours() * 60 + z.getMinutes();
}

function hhmmToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function travelMinutes(from: Point | null, to: Point | null): number {
  if (!from || !to) return 15;
  const rad = Math.PI / 180;
  const dLat = (to.latitude - from.latitude) * rad;
  const dLng = (to.longitude - from.longitude) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(from.latitude * rad) *
      Math.cos(to.latitude * rad) *
      Math.sin(dLng / 2) ** 2;
  const km = 6371 * 2 * Math.asin(Math.sqrt(a));
  return Math.ceil(((km * ROAD_FACTOR) / AVG_SPEED_KMH) * 60);
}

function canFollow(a: Ride, b: Ride): boolean {
  return (
    a.end + BASE_TURNAROUND_MIN + travelMinutes(a.dropoff, b.pickup) <= b.start
  );
}

function compatible(a: Ride, b: Ride): boolean {
  return canFollow(a, b) || canFollow(b, a);
}

const SERVICE_START = hhmmToMin(SERVICE_START_TIME);
const SERVICE_END = hhmmToMin(SERVICE_END_TIME);
const SERVICE_HOURS = `${formatMinutes(SERVICE_START)}–${formatMinutes(SERVICE_END)}`;

function inServiceHours(ride: Ride): boolean {
  return SERVICE_START <= ride.start && ride.start <= SERVICE_END;
}

function touchesDay(ride: Ride): boolean {
  return ride.end > 0 && ride.start < DAY_MIN;
}

function indexBusy(busy: Ride[]) {
  const byDriver = new Map<string, Ride[]>();
  const byVehicle = new Map<string, Ride[]>();
  for (const r of busy) {
    if (r.driverId)
      byDriver.set(r.driverId, [...(byDriver.get(r.driverId) ?? []), r]);
    if (r.vehicleId)
      byVehicle.set(r.vehicleId, [...(byVehicle.get(r.vehicleId) ?? []), r]);
  }
  return { byDriver, byVehicle };
}

/** Overlap and accessibility problems with booking `ride` on a driver and vehicle. */
function bookingProblems(
  ride: Ride,
  driver: { id: string; name: string },
  vehicle: { id: string; label: string; wheelchair: boolean },
  busyByDriver: Map<string, Ride[]>,
  busyByVehicle: Map<string, Ride[]>,
): string[] {
  const problems: string[] = [];
  const driverClash = (busyByDriver.get(driver.id) ?? []).find(
    (b) => b.id !== ride.id && !compatible(b, ride),
  );
  if (driverClash)
    problems.push(
      `${driver.name} is already driving ${driverClash.studentName} at ${formatMinutes(driverClash.start)}.`,
    );
  if (ride.needsWheelchair && !vehicle.wheelchair)
    problems.push(`Vehicle ${vehicle.label} is not wheelchair-accessible.`);
  const vehicleClash = (busyByVehicle.get(vehicle.id) ?? []).find(
    (b) => b.id !== ride.id && !compatible(b, ride),
  );
  if (vehicleClash)
    problems.push(
      `Vehicle ${vehicle.label} is already in use for ${vehicleClash.studentName} at ${formatMinutes(vehicleClash.start)}.`,
    );
  return problems;
}

async function loadDay(date: string) {
  await connectMongoDB();
  const dayStart = fromZonedTime(`${date}T00:00:00`, TZ);
  const dayEnd = fromZonedTime(`${date}T23:59:59.999`, TZ);
  const dayOfWeek = toZonedTime(dayStart, TZ).getDay();

  // Bookings from the neighbouring days can run across midnight into this one.
  const [vehicles, routes] = await Promise.all([
    VehicleModel.find().lean(),
    RouteModel.find({
      $or: [
        {
          status: RouteStatus.Requested,
          scheduledPickupTime: { $gte: dayStart, $lte: dayEnd },
        },
        {
          status: { $in: BUSY_STATUSES },
          scheduledPickupTime: {
            $gte: new Date(dayStart.getTime() - DAY_MS),
            $lte: new Date(dayEnd.getTime() + DAY_MS),
          },
        },
      ],
    }).lean(),
  ]);
  const bookedDriverIds = routes.flatMap((r) => r.driver?._id ?? []);
  const [drivers, students] = await Promise.all([
    DriverModel.find({
      $or: [
        { "shifts.dayOfWeek": dayOfWeek },
        { _id: { $in: bookedDriverIds } },
      ],
    }).lean(),
    StudentModel.find(
      { _id: { $in: routes.map((r) => r.student._id) } },
      { studentInfo: 1 },
    ).lean(),
  ]);
  // The ride embeds a copy of the student; profile edits only reach this one.
  const needsByStudent = new Map(
    students.map((st) => [
      st._id.toString(),
      st.studentInfo?.accessibilityNeeds ?? [],
    ]),
  );

  const locationIds = new Set(
    routes.flatMap((r) => [
      r.pickupLocation.toString(),
      r.dropoffLocation.toString(),
    ]),
  );
  const locations = new Map(
    (await LocationModel.find({ _id: { $in: [...locationIds] } }).lean()).map(
      (l) => [l._id.toString(), l],
    ),
  );

  const toRide = (r: (typeof routes)[number]): Ride => {
    const accommodations =
      needsByStudent.get(r.student._id.toString()) ??
      (r.student as { studentInfo?: { accessibilityNeeds?: string[] } })
        .studentInfo?.accessibilityNeeds ??
      [];
    const needsWheelchair = accommodations.some((a) =>
      a.toLowerCase().includes("wheelchair"),
    );
    const boarding = accommodations.length
      ? needsWheelchair
        ? WHEELCHAIR_BOARDING_MIN
        : OTHER_ACCOMMODATION_BOARDING_MIN
      : 0;
    const start = minutesFromDay(r.scheduledPickupTime, date);
    const pickupLoc = locations.get(r.pickupLocation.toString());
    const dropoffLoc = locations.get(r.dropoffLocation.toString());
    const estimatedDropoff = r.estimatedDropoffTime
      ? minutesFromDay(r.estimatedDropoffTime, date)
      : null;
    const busyUntil =
      estimatedDropoff ??
      start + travelMinutes(pickupLoc ?? null, dropoffLoc ?? null);
    return {
      id: r._id.toString(),
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      accommodations,
      needsWheelchair,
      start,
      end: Math.max(busyUntil, start) + boarding,
      pickupWindowStart: minutesFromDay(r.pickupWindowStart, date),
      pickupWindowEnd: minutesFromDay(r.pickupWindowEnd, date),
      estimatedDropoff,
      pickup: pickupLoc ?? null,
      dropoff: dropoffLoc ?? null,
      pickupName: pickupLoc?.name ?? "",
      dropoffName: dropoffLoc?.name ?? "",
      driverId: r.driver?._id.toString(),
      vehicleId: (r.vehicle as { _id?: unknown } | undefined)?._id?.toString(),
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
      id: d._id.toString(),
      name: `${d.firstName} ${d.lastName}`,
      shifts: (d.shifts ?? [])
        .filter((s) => s.dayOfWeek === dayOfWeek)
        .map((s) => ({
          start: hhmmToMin(s.startTime),
          end: hhmmToMin(s.endTime),
        })),
    })),
    vehicles: vehicles.map((v) => ({
      id: v._id.toString(),
      label: v.vehicleId || v.name,
      wheelchair: v.accessibility === "Wheelchair",
    })),
    requested,
    busy,
  };
}

type DayData = Awaited<ReturnType<typeof loadDay>>;

/** Explains, in admin-facing terms, why a submitted assignment is not allowed. */
function diagnoseAssignment(
  a: { rideId: string; driverId: string; vehicleId: string },
  ctx: Pick<DayData, "requested" | "busy" | "drivers" | "vehicles"> & {
    vars: { ride: number; driver: number; vehicle: number }[];
    busyByDriver: Map<string, Ride[]>;
    busyByVehicle: Map<string, Ride[]>;
  },
): string[] {
  const ri = ctx.requested.findIndex((r) => r.id === a.rideId);
  if (ri === -1) {
    const booked = ctx.busy.find((r) => r.id === a.rideId);
    const bookedWith = ctx.drivers.find((d) => d.id === booked?.driverId)?.name;
    return [
      booked
        ? `${booked.studentName} (${formatMinutes(booked.start)}) is already booked${bookedWith ? ` with ${bookedWith}` : ""}.`
        : `Ride ${a.rideId} is no longer requested on this day; it may have been cancelled or moved.`,
    ];
  }
  const ride = ctx.requested[ri];
  const di = ctx.drivers.findIndex((d) => d.id === a.driverId);
  const vi = ctx.vehicles.findIndex((v) => v.id === a.vehicleId);
  if (
    ctx.vars.some((x) => x.ride === ri && x.driver === di && x.vehicle === vi)
  )
    return [];

  const who = `${ride.studentName} (${formatMinutes(ride.start)})`;
  if (di === -1)
    return [`${who}: the driver no longer exists or has no shift today.`];
  if (vi === -1) return [`${who}: the vehicle no longer exists.`];
  const d = ctx.drivers[di];
  const v = ctx.vehicles[vi];
  const problems: string[] = [];
  if (!inServiceHours(ride))
    problems.push(
      `${who}: pickup is outside service hours (${SERVICE_HOURS}).`,
    );
  if (!d.shifts.some((s) => s.start <= ride.start && ride.end <= s.end))
    problems.push(
      `${who}: ${d.name} is not on shift for the whole ride (${
        d.shifts.length
          ? d.shifts
              .map((s) => `${formatMinutes(s.start)}–${formatMinutes(s.end)}`)
              .join(", ")
          : "no shift today"
      }).`,
    );
  for (const p of bookingProblems(
    ride,
    d,
    v,
    ctx.busyByDriver,
    ctx.busyByVehicle,
  ))
    problems.push(`${who}: ${p}`);
  return problems.length
    ? problems
    : [`${who}: assignment is no longer valid.`];
}

/**
 * Builds and solves the assignment MIP for one day. One binary x per feasible
 * ride/driver/vehicle triple; `fixed` restricts the model to exactly those
 * assignments so it doubles as a feasibility check before applying.
 */
export async function planDay(
  date: string,
  fixed?: { rideId: string; driverId: string; vehicleId: string }[],
): Promise<AutoSchedulePlan> {
  const { drivers, vehicles, requested, busy } = await loadDay(date);
  const fixedKeys = fixed
    ? new Set(fixed.map((f) => `${f.rideId}|${f.driverId}|${f.vehicleId}`))
    : null;

  const { byDriver: busyByDriver, byVehicle: busyByVehicle } = indexBusy(busy);
  const busyToday = busy.filter(touchesDay);
  const shownByDriver = indexBusy(busyToday).byDriver;
  const pairsInUse = new Set(
    busyToday.flatMap((r) =>
      r.driverId && r.vehicleId ? [`${r.driverId}|${r.vehicleId}`] : [],
    ),
  );

  type Var = { name: string; ride: number; driver: number; vehicle: number };
  const vars: Var[] = [];
  const reasons = new Map<string, string>();

  requested.forEach((ride, ri) => {
    const onShift = drivers
      .map((d, di) => ({ d, di }))
      .filter(({ d }) =>
        d.shifts.some((s) => s.start <= ride.start && ride.end <= s.end),
      );
    const freeDrivers = onShift.filter(({ d }) =>
      (busyByDriver.get(d.id) ?? []).every((b) => compatible(b, ride)),
    );
    const suitableVehicles = vehicles
      .map((v, vi) => ({ v, vi }))
      .filter(({ v }) => !ride.needsWheelchair || v.wheelchair);
    const freeVehicles = suitableVehicles.filter(({ v }) =>
      (busyByVehicle.get(v.id) ?? []).every((b) => compatible(b, ride)),
    );

    if (!inServiceHours(ride)) {
      reasons.set(
        ride.id,
        `Pickup is outside service hours (${SERVICE_HOURS})`,
      );
      return;
    }
    if (!onShift.length)
      reasons.set(ride.id, "No driver is on shift for the whole ride");
    else if (!freeDrivers.length)
      reasons.set(ride.id, "Every on-shift driver already has a ride then");
    else if (!suitableVehicles.length)
      reasons.set(ride.id, "Needs a wheelchair vehicle, and none exist");
    else if (!freeVehicles.length)
      reasons.set(ride.id, "Every suitable vehicle is already in use then");
    else
      reasons.set(
        ride.id,
        "Overlaps other rides; not enough drivers or vehicles for all of them",
      );

    for (const { d, di } of freeDrivers) {
      for (const { v, vi } of freeVehicles) {
        if (fixedKeys && !fixedKeys.has(`${ride.id}|${d.id}|${v.id}`)) continue;
        vars.push({
          name: `x_${ri}_${di}_${vi}`,
          ride: ri,
          driver: di,
          vehicle: vi,
        });
      }
    }
  });

  if (fixed) {
    const problems = fixed.flatMap((f) =>
      diagnoseAssignment(f, {
        requested,
        busy,
        drivers,
        vehicles,
        vars,
        busyByDriver,
        busyByVehicle,
      }),
    );
    if (problems.length) {
      throw new AutoScheduleConflictError(
        `${problems.length} proposed ${problems.length === 1 ? "assignment is" : "assignments are"} no longer valid. Regenerate the schedule.`,
        problems,
      );
    }
    const clashes: string[] = [];
    for (let i = 0; i < vars.length; i++) {
      for (let j = i + 1; j < vars.length; j++) {
        const [a, b] = [vars[i], vars[j]];
        const [ra, rb] = [requested[a.ride], requested[b.ride]];
        if (compatible(ra, rb)) continue;
        if (a.driver === b.driver)
          clashes.push(
            `${ra.studentName} (${formatMinutes(ra.start)}) and ${rb.studentName} (${formatMinutes(rb.start)}) would both be driven by ${drivers[a.driver].name}`,
          );
        if (a.vehicle === b.vehicle)
          clashes.push(
            `${ra.studentName} (${formatMinutes(ra.start)}) and ${rb.studentName} (${formatMinutes(rb.start)}) would both use vehicle ${vehicles[a.vehicle].label}`,
          );
      }
    }
    if (clashes.length) {
      throw new AutoScheduleConflictError(
        "Proposed assignments overlap each other. Regenerate the schedule.",
        clashes,
      );
    }
  }

  const objective: string[] = [];
  const constraints: string[] = [];
  const pairVars = new Map<string, Var[]>();
  const byRideDriver = new Map<string, string[]>();
  const byRideVehicle = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, k: string, v: string) =>
    m.set(k, [...(m.get(k) ?? []), v]);

  for (const x of vars) {
    const ride = requested[x.ride];
    const misuse =
      vehicles[x.vehicle].wheelchair && !ride.needsWheelchair
        ? ACCESSIBLE_VEHICLE_MISUSE_COST
        : 0;
    objective.push(`+ ${RIDE_WEIGHT - misuse} ${x.name}`);
    push(byRideDriver, `${x.ride}|${x.driver}`, x.name);
    push(byRideVehicle, `${x.ride}|${x.vehicle}`, x.name);
    const pk = `${x.driver}|${x.vehicle}`;
    pairVars.set(pk, [...(pairVars.get(pk) ?? []), x]);
  }

  // Each ride gets at most one driver/vehicle (exactly one when validating).
  requested.forEach((_, ri) => {
    const names = vars.filter((x) => x.ride === ri).map((x) => x.name);
    if (names.length)
      constraints.push(`${names.join(" + ")} ${fixed ? "=" : "<="} 1`);
  });

  // No driver or vehicle takes two rides that overlap once turnaround is added.
  for (let i = 0; i < requested.length; i++) {
    for (let j = i + 1; j < requested.length; j++) {
      if (compatible(requested[i], requested[j])) continue;
      drivers.forEach((_, di) => {
        const names = [
          ...(byRideDriver.get(`${i}|${di}`) ?? []),
          ...(byRideDriver.get(`${j}|${di}`) ?? []),
        ];
        if (names.length > 1) constraints.push(`${names.join(" + ")} <= 1`);
      });
      vehicles.forEach((_, vi) => {
        const names = [
          ...(byRideVehicle.get(`${i}|${vi}`) ?? []),
          ...(byRideVehicle.get(`${j}|${vi}`) ?? []),
        ];
        if (names.length > 1) constraints.push(`${names.join(" + ")} <= 1`);
      });
    }
  }

  // Prefer keeping each driver in the same vehicle across the day.
  const pairNames: string[] = [];
  for (const [pk, xs] of pairVars) {
    const [di, vi] = pk.split("|").map(Number);
    const y = `y_${di}_${vi}`;
    pairNames.push(y);
    const cost = pairsInUse.has(`${drivers[di].id}|${vehicles[vi].id}`)
      ? 0
      : NEW_DRIVER_VEHICLE_PAIR_COST;
    if (cost) objective.push(`- ${cost} ${y}`);
    constraints.push(
      `${xs.map((x) => x.name).join(" + ")} - ${xs.length} ${y} <= 0`,
    );
  }

  let solverStatus = "Empty";
  const chosen = new Set<string>();
  if (vars.length) {
    // One term per line keeps rows under the LP reader's line-length limit.
    const lp = [
      "Maximize",
      ` obj: ${objective.join("\n ")}`,
      "Subject To",
      ...constraints.map((c, k) => ` c${k}: ${c.split(" + ").join("\n + ")}`),
      "Binary",
      ...[...vars.map((x) => x.name), ...pairNames].map((n) => ` ${n}`),
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
    for (const x of vars) {
      const col = result.Columns[x.name];
      if (col && "Primal" in col && col.Primal > 0.5) chosen.add(x.name);
    }
  }

  const assignments = vars
    .filter((x) => chosen.has(x.name))
    .map((x) => ({
      rideId: requested[x.ride].id,
      driverId: drivers[x.driver].id,
      vehicleId: vehicles[x.vehicle].id,
    }));
  const assignedRides = new Set(assignments.map((a) => a.rideId));

  const doubleBookings: AutoSchedulePlan["doubleBookings"] = [];
  const findOverlaps = (
    resource: "driver" | "vehicle",
    byResource: Map<string, Ride[]>,
    nameOf: (id: string) => string,
  ) => {
    for (const [id, rides] of byResource) {
      for (let i = 0; i < rides.length; i++) {
        for (let j = i + 1; j < rides.length; j++) {
          if (!compatible(rides[i], rides[j])) {
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
    if (ride.start < 0) return [];
    const d = drivers.find((dd) => dd.id === ride.driverId);
    if (!d || d.shifts.some((s) => s.start <= ride.start && ride.end <= s.end))
      return [];
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

//Problems with booking a requested ride on a driver and vehicle given the bookings currently stored.
export async function findBookingConflicts(
  routeId: string,
  driverId: string,
  vehicleId: string,
): Promise<string[]> {
  await connectMongoDB();
  const route = await RouteModel.findById(routeId, {
    scheduledPickupTime: 1,
  }).lean();
  if (!route) return [];
  const { drivers, vehicles, requested, busy } = await loadDay(
    formatInTimeZone(route.scheduledPickupTime, TZ, "yyyy-MM-dd"),
  );
  const ride = requested.find((r) => r.id === routeId);
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  if (!ride || !vehicle) return [];
  const driver = drivers.find((d) => d.id === driverId) ?? {
    id: driverId,
    name: "The driver",
  };
  const { byDriver, byVehicle } = indexBusy(busy);
  return bookingProblems(ride, driver, vehicle, byDriver, byVehicle);
}
