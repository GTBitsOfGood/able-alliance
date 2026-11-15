import type {
  AutoSchedulePlan,
  ScheduleAssignment,
  ScheduleRide,
} from "@/types/autoSchedule";
import type { VehicleEntry } from "@/types/admin";

/** Combine saved rides and the current draft into rows shared by the table and timeline. */
export function buildScheduleRides(
  plan: AutoSchedulePlan | null,
  draft: ScheduleAssignment[],
  vehicles: VehicleEntry[],
  generated: boolean,
): ScheduleRide[] {
  const conflictNotes = new Map<string, string[]>();
  for (const conflict of plan?.doubleBookings ?? []) {
    for (const ride of conflict.rides) {
      conflictNotes.set(ride.id, [
        ...(conflictNotes.get(ride.id) ?? []),
        `Double-booked ${conflict.resource}: ${conflict.name}`,
      ]);
    }
  }

  for (const { ride, driverName } of plan?.offShiftBookings ?? []) {
    conflictNotes.set(ride.id, [
      ...(conflictNotes.get(ride.id) ?? []),
      `Outside ${driverName}'s shift`,
    ]);
  }

  const rideRows = [
    ...(plan?.drivers.flatMap((driver) =>
      driver.rides.map((ride) => {
        const assignment = draft.find((a) => a.rideId === ride.id);
        const assignedDriver = plan.drivers.find(
          (d) => d._id === assignment?.driverId,
        );
        const vehicle = vehicles.find((v) => v.id === assignment?.vehicleId);

        return {
          ...ride,
          driverId: assignment?.driverId ?? driver._id,
          driverName: assignedDriver?.name ?? driver.name,
          vehicleId: assignment?.vehicleId ?? ride.vehicleId,
          vehicleLabel: vehicle
            ? `${vehicle.name} (${vehicle.licensePlate})`
            : ride.vehicleLabel,
          reason: conflictNotes.get(ride.id)?.join(" · ") ?? "",
        };
      }),
    ) ?? []),
    ...(plan?.unassigned.map((ride) => ({
      ...ride,
      kind: "unassigned" as const,
      driverName: "—",
      reason: generated ? ride.reason : "Awaiting assignment",
    })) ?? []),
  ].sort(
    (a, b) => a.start - b.start || a.studentName.localeCompare(b.studentName),
  );

  return rideRows.map((ride) => ({
    ...ride,
    needsReview:
      conflictNotes.has(ride.id) || (generated && ride.kind === "unassigned"),
  }));
}
