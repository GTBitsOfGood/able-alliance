/**
 * Scheduling transactions, UI-agnostic. A stale batch fails atomically,
 * leaving no partial assignment, audit, or notification-triggering result.
 */
import { formatInTimeZone } from "date-fns-tz";
import { test, expect } from "./fixtures";
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
