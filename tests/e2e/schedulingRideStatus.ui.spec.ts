/**
 * Scheduling ride status through the pages. A stale assignment modal is
 * rejected when the ride was cancelled after it opened, but still saves when
 * the ride was scheduled in the meantime, since scheduled rides can be
 * reassigned.
 */
import { test, expect } from "./fixtures";
import {
  createDriver,
  createRide,
  createStudent,
  createVehicle,
  futureSlot,
  openScheduleModal,
  routeState,
  schedule,
  selectModalAssignment,
  studentApi,
} from "./schedulingTestHelpers";

test("scheduling ride status: stale assignment modals follow the ride status (UI)", async ({
  apiAs,
  pageAs,
  playwright,
  diag,
}) => {
  test.setTimeout(90_000);

  const adminApi = await apiAs("admin");
  const pickup = futureSlot(38, "10:00");
  const driver = await createDriver(adminApi, "uistatusdriver", pickup);
  const vehicle = await createVehicle(adminApi, "uistatusvehicle");
  const students = await Promise.all([
    createStudent(adminApi, "uicancelledstudent"),
    createStudent(adminApi, "uischeduledstudent"),
  ]);
  const clients = await Promise.all(
    students.map((student) => studentApi(playwright, student)),
  );

  try {
    const cancelledRoute = await createRide(clients[0], pickup);
    const scheduledRoute = await createRide(
      clients[1],
      futureSlot(38, "14:00"),
    );
    const admin = await pageAs("admin");
    await admin.goto("/admin/rides");

    const cancelledAssignment = await openScheduleModal(admin, cancelledRoute);
    await selectModalAssignment(
      admin,
      cancelledAssignment.dialog,
      driver,
      vehicle,
    );

    const cancellation = await clients[0].post("/api/routes/cancel", {
      data: { routeId: cancelledRoute },
    });
    expect(cancellation.status(), await cancellation.text()).toBe(200);
    const cancelledResponse = admin.waitForResponse((r) =>
      r.url().endsWith("/api/routes/schedule"),
    );
    await cancelledAssignment.dialog
      .getByRole("button", { name: "Save", exact: true })
      .click();
    expect((await cancelledResponse).status()).toBe(409);
    await expect(
      cancelledAssignment.dialog.getByText(/Route is not in Requested/i),
    ).toBeVisible();
    await cancelledAssignment.dialog
      .getByRole("button", { name: "Nevermind", exact: true })
      .click();

    const scheduledAssignment = await openScheduleModal(admin, scheduledRoute);
    await selectModalAssignment(
      admin,
      scheduledAssignment.dialog,
      driver,
      vehicle,
    );
    const firstAssignment = await schedule(
      adminApi,
      scheduledRoute,
      driver.id,
      vehicle.id,
    );
    expect(firstAssignment.status(), await firstAssignment.text()).toBe(200);

    const scheduledResponse = admin.waitForResponse((r) =>
      r.url().endsWith("/api/routes/schedule"),
    );
    await scheduledAssignment.dialog
      .getByRole("button", { name: "Save", exact: true })
      .click();
    const saved = await scheduledResponse;
    expect(saved.status(), await saved.text()).toBe(200);
    await expect(scheduledAssignment.dialog).toBeHidden();

    expect((await routeState(adminApi, cancelledRoute)).status).toBe(
      "CancelledByStudent",
    );
    expect(await routeState(adminApi, scheduledRoute)).toMatchObject({
      status: "Scheduled",
      driver: { id: driver.id },
      vehicle: { id: vehicle.id },
    });
    expect(diag.apiFailures).toHaveLength(1);
    expect(diag.apiFailures[0].status).toBe(409);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
