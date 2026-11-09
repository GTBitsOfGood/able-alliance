import type { Prisma } from "@db/generated/client";

export type Assignment = {
  rideId: string;
  driverId: string;
  vehicleId: string;
};

export type ScheduleAssignment = (
  routeId: string,
  driverId: string,
  vehicleId: string,
  tx: Prisma.TransactionClient,
  afterCommit: (() => void)[],
  actorId: string,
) => Promise<unknown>;

type AssignmentPlan = {
  drivers: {
    name: string;
    rides: {
      id: string;
      kind: "existing" | "proposed";
      studentName: string;
      start: number;
      vehicleLabel?: string;
    }[];
  }[];
};

type ApplyDependencies = {
  scheduleAssignment: ScheduleAssignment;
  planAssignments: (
    date: string,
    assignments: Assignment[],
    tx: Prisma.TransactionClient,
  ) => Promise<AssignmentPlan>;
  formatPickup: (minutes: number) => string;
};

export async function applyAssignments(
  date: string,
  assignments: Assignment[],
  tx: Prisma.TransactionClient,
  afterCommit: (() => void)[],
  actorId: string,
  { scheduleAssignment, planAssignments, formatPickup }: ApplyDependencies,
) {
  const plan = await planAssignments(date, assignments, tx);
  const info = new Map(
    plan.drivers.flatMap((d) =>
      d.rides
        .filter((r) => r.kind === "proposed")
        .map((r) => [r.id, { ride: r, driverName: d.name }] as const),
    ),
  );

  const results = [];
  // A write failure must escape this loop so the enclosing transaction rolls
  // back every earlier assignment and its audit entry.
  for (const assignment of assignments) {
    const found = info.get(assignment.rideId);
    await scheduleAssignment(
      assignment.rideId,
      assignment.driverId,
      assignment.vehicleId,
      tx,
      afterCommit,
      actorId,
    );
    results.push({
      rideId: assignment.rideId,
      studentName: found?.ride.studentName ?? "Unknown student",
      pickup: found ? formatPickup(found.ride.start) : "",
      driverName: found?.driverName ?? "Unknown driver",
      vehicleLabel: found?.ride.vehicleLabel ?? "",
      success: true,
    });
  }
  return results;
}
