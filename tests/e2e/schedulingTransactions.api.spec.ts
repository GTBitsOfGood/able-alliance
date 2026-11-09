/**
 * Scheduling transactions, UI-agnostic. A stale batch fails atomically,
 * leaving no partial assignment, audit, or notification-triggering result.
 */
import { formatInTimeZone } from "date-fns-tz";
import { PrismaPg } from "@prisma/adapter-pg";
import { recordAudit } from "@db/audit";
import { PrismaClient, RouteStatus } from "@db/generated/client";
import {
  applyAssignments,
  type ScheduleAssignment,
} from "@/server/scheduling/applyAssignments";
import { test, expect } from "./fixtures";
import { E2E } from "./env";
import { PERSONAS } from "./seed";
import {
  createDriver,
  createRide,
  createStudent,
  createVehicle,
  futureSlot,
  routeState,
  routeUpdateAuditCount,
  studentApi,
} from "./schedulingTestHelpers";

const TZ = "America/New_York";

test("scheduling transactions: failed batch leaves no partial changes", async ({
  apiAs,
  playwright,
}) => {
  const admin = await apiAs("admin");
  const pickup = futureSlot(34, "10:00");
  const driver = await createDriver(admin, "transactiondriver", pickup);
  const vehicle = await createVehicle(admin, "transactionvehicle");
  const students = await Promise.all([
    createStudent(admin, "validbatchstudent"),
    createStudent(admin, "cancelledbatchstudent"),
  ]);
  const clients = await Promise.all(
    students.map((student) => studentApi(playwright, student)),
  );

  try {
    const validRoute = await createRide(clients[0], pickup);
    const cancelledRoute = await createRide(
      clients[1],
      futureSlot(34, "14:00"),
    );
    const cancellation = await clients[1].post("/api/routes/cancel", {
      data: { routeId: cancelledRoute },
    });
    expect(cancellation.status(), await cancellation.text()).toBe(200);
    const auditBefore = await routeUpdateAuditCount(admin, [
      validRoute,
      cancelledRoute,
    ]);

    const response = await admin.post("/api/routes/auto-schedule", {
      data: {
        date: formatInTimeZone(pickup, TZ, "yyyy-MM-dd"),
        assignments: [
          {
            rideId: validRoute,
            driverId: driver.id,
            vehicleId: vehicle.id,
          },
          {
            rideId: cancelledRoute,
            driverId: driver.id,
            vehicleId: vehicle.id,
          },
        ],
      },
    });
    const body = (await response.json()) as {
      error?: string;
      results?: unknown[];
    };
    expect(response.status()).toBe(409);
    expect(body.error).toMatch(/no longer valid/i);
    expect(body.results).toBeUndefined();
    expect(await routeState(admin, validRoute)).toMatchObject({
      status: "Requested",
      driver: null,
      vehicle: null,
    });
    expect((await routeState(admin, cancelledRoute)).status).toBe(
      "CancelledByStudent",
    );
    expect(
      await routeUpdateAuditCount(admin, [validRoute, cancelledRoute]),
    ).toBe(auditBefore);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});

test("scheduling transactions: later write failure rolls back earlier assignment", async ({
  apiAs,
  playwright,
}) => {
  const admin = await apiAs("admin");
  const pickup = futureSlot(35, "10:00");
  const driver = await createDriver(admin, "rollbackdriver", pickup);
  const vehicle = await createVehicle(admin, "rollbackvehicle");
  const students = await Promise.all([
    createStudent(admin, "rollbackfirststudent"),
    createStudent(admin, "rollbacksecondstudent"),
  ]);
  const clients = await Promise.all(
    students.map((student) => studentApi(playwright, student)),
  );
  const directDb = new PrismaClient({
    adapter: new PrismaPg({ connectionString: E2E.databaseUrl }),
  });

  try {
    const firstRoute = await createRide(clients[0], pickup);
    const secondRoute = await createRide(clients[1], futureSlot(35, "14:00"));
    const assignments = [firstRoute, secondRoute].map((rideId) => ({
      rideId,
      driverId: driver.id,
      vehicleId: vehicle.id,
    }));
    const auditBefore = await routeUpdateAuditCount(admin, [
      firstRoute,
      secondRoute,
    ]);
    const attempted: string[] = [];
    const failSecond: ScheduleAssignment = async (
      routeId,
      driverId,
      vehicleId,
      tx,
    ) => {
      attempted.push(routeId);
      if (routeId === secondRoute)
        throw new Error("Injected later assignment failure");
      const before = await tx.route.findUniqueOrThrow({
        where: { id: routeId },
      });
      const updated = await tx.route.update({
        where: { id: routeId },
        data: {
          driverId,
          vehicleId,
          status: RouteStatus.Scheduled,
        },
      });
      await recordAudit(tx, {
        actorId: PERSONAS.admin.id,
        entityType: "Route",
        entityId: routeId,
        action: "Update",
        before,
        after: updated,
      });
      return updated;
    };

    await expect(
      directDb.$transaction((tx) =>
        applyAssignments(
          formatInTimeZone(pickup, TZ, "yyyy-MM-dd"),
          assignments,
          tx,
          [],
          PERSONAS.admin.id,
          {
            scheduleAssignment: failSecond,
            planAssignments: async () => ({
              drivers: [
                {
                  name: `${driver.firstName} ${driver.lastName}`,
                  rides: assignments.map((assignment, index) => ({
                    id: assignment.rideId,
                    kind: "proposed" as const,
                    studentName: `${students[index].firstName} ${students[index].lastName}`,
                    start: index === 0 ? 10 * 60 : 14 * 60,
                    vehicleLabel: vehicle.name,
                  })),
                },
              ],
            }),
            formatPickup: String,
          },
        ),
      ),
    ).rejects.toThrow("Injected later assignment failure");

    expect(attempted).toEqual([firstRoute, secondRoute]);
    for (const routeId of [firstRoute, secondRoute]) {
      expect(await routeState(admin, routeId)).toMatchObject({
        status: "Requested",
        driver: null,
        vehicle: null,
      });
    }
    expect(await routeUpdateAuditCount(admin, [firstRoute, secondRoute])).toBe(
      auditBefore,
    );
  } finally {
    await Promise.all([
      ...clients.map((client) => client.dispose()),
      directDb.$disconnect(),
    ]);
  }
});
