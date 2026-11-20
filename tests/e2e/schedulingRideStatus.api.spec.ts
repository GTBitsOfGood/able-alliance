/**
 * Scheduling ride status, UI-agnostic. A cancelled ride can no longer be
 * assigned, while an already scheduled ride can be reassigned in place.
 */
import { test, expect } from "./fixtures";
import {
  createDriver,
  createRide,
  createStudent,
  createVehicle,
  futureSlot,
  routeState,
  schedule,
  studentApi,
} from "./schedulingTestHelpers";

test("scheduling ride status: rejects cancelled rides, reassigns scheduled rides", async ({
  apiAs,
  playwright,
}) => {
  const admin = await apiAs("admin");
  const pickup = futureSlot(33, "10:00");
  const [driver, otherDriver] = await Promise.all([
    createDriver(admin, "statusdriver", pickup),
    createDriver(admin, "statusdriverb", pickup),
  ]);
  const vehicle = await createVehicle(admin, "statusvehicle");
  const students = await Promise.all([
    createStudent(admin, "cancelledstudent"),
    createStudent(admin, "scheduledstudent"),
  ]);
  const clients = await Promise.all(
    students.map((student) => studentApi(playwright, student)),
  );

  try {
    const cancelledRoute = await createRide(clients[0], pickup);
    const cancellation = await clients[0].post("/api/routes/cancel", {
      data: { routeId: cancelledRoute },
    });
    expect(cancellation.status(), await cancellation.text()).toBe(200);
    const cancelledAssignment = await schedule(
      admin,
      cancelledRoute,
      driver.id,
      vehicle.id,
    );
    expect(cancelledAssignment.status()).toBe(409);
    expect(await cancelledAssignment.text()).toMatch(
      /Route is not in Requested/i,
    );

    const scheduledRoute = await createRide(
      clients[1],
      futureSlot(33, "14:00"),
    );
    const firstAssignment = await schedule(
      admin,
      scheduledRoute,
      driver.id,
      vehicle.id,
    );
    expect(firstAssignment.status(), await firstAssignment.text()).toBe(200);
    // Admins may hand a scheduled ride to another driver without unscheduling it.
    const reassignment = await schedule(
      admin,
      scheduledRoute,
      otherDriver.id,
      vehicle.id,
    );
    expect(reassignment.status(), await reassignment.text()).toBe(200);

    expect((await routeState(admin, cancelledRoute)).status).toBe(
      "CancelledByStudent",
    );
    expect(await routeState(admin, scheduledRoute)).toMatchObject({
      status: "Scheduled",
      driver: { id: otherDriver.id },
      vehicle: { id: vehicle.id },
    });
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
