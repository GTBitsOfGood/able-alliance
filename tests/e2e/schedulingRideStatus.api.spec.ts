/**
 * Scheduling ride status, UI-agnostic. Cancelled and already scheduled rides
 * cannot be assigned again.
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

test("scheduling ride status: rejects cancelled and scheduled rides", async ({
  apiAs,
  playwright,
}) => {
  const admin = await apiAs("admin");
  const pickup = futureSlot(33, "10:00");
  const driver = await createDriver(admin, "statusdriver", pickup);
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
    expect(await cancelledAssignment.text()).toMatch(/no longer in Requested/i);

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
    const duplicateAssignment = await schedule(
      admin,
      scheduledRoute,
      driver.id,
      vehicle.id,
    );
    expect(duplicateAssignment.status()).toBe(409);
    expect(await duplicateAssignment.text()).toMatch(/no longer in Requested/i);
    expect((await routeState(admin, cancelledRoute)).status).toBe(
      "CancelledByStudent",
    );
    expect((await routeState(admin, scheduledRoute)).status).toBe("Scheduled");
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
