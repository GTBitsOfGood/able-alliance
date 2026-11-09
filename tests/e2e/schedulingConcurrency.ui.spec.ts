/**
 * Scheduling concurrency through the pages. Two admins submit overlapping
 * assignments together; one succeeds and the other keeps its row with an error.
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
  selectModalAssignment,
  studentApi,
} from "./schedulingTestHelpers";

test("scheduling concurrency: overlapping UI assignments cannot double-book resources", async ({
  apiAs,
  pageAs,
  playwright,
  diag,
}) => {
  test.setTimeout(90_000);

  const adminApi = await apiAs("admin");
  const morning = futureSlot(35, "10:00");
  const afternoon = futureSlot(35, "15:00");
  const driverA = await createDriver(adminApi, "uidrivera", morning);
  const driverB = await createDriver(adminApi, "uidriverb", morning);
  const vehicleA = await createVehicle(adminApi, "uivehiclea");
  const vehicleB = await createVehicle(adminApi, "uivehicleb");
  const sharedVehicle = await createVehicle(adminApi, "uisharedvehicle");
  const students = await Promise.all(
    ["uistudenta", "uistudentb", "uistudentc", "uistudentd"].map((label) =>
      createStudent(adminApi, label),
    ),
  );
  const clients = await Promise.all(
    students.map((student) => studentApi(playwright, student)),
  );

  try {
    const routes = await Promise.all([
      createRide(clients[0], morning),
      createRide(clients[1], morning),
      createRide(clients[2], afternoon),
      createRide(clients[3], afternoon),
    ]);
    const adminA = await pageAs("admin");
    const adminB = await pageAs("admin");
    await Promise.all([
      adminA.goto("/admin/rides"),
      adminB.goto("/admin/rides"),
    ]);

    const driverAssignments = [
      await openScheduleModal(adminA, routes[0]),
      await openScheduleModal(adminB, routes[1]),
    ];
    await selectModalAssignment(
      adminA,
      driverAssignments[0].dialog,
      driverA,
      vehicleA,
    );
    await selectModalAssignment(
      adminB,
      driverAssignments[1].dialog,
      driverA,
      vehicleB,
    );

    const driverResponses = [
      adminA.waitForResponse((r) => r.url().endsWith("/api/routes/schedule")),
      adminB.waitForResponse((r) => r.url().endsWith("/api/routes/schedule")),
    ];
    await Promise.all([
      driverAssignments[0].dialog
        .getByRole("button", { name: "Save", exact: true })
        .click(),
      driverAssignments[1].dialog
        .getByRole("button", { name: "Save", exact: true })
        .click(),
    ]);
    const driverResults = await Promise.all(driverResponses);
    expect(driverResults.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);

    const driverStates = await Promise.all(
      routes.slice(0, 2).map((routeId) => routeState(adminApi, routeId)),
    );
    expect(
      driverStates.filter((route) => route.status === "Scheduled"),
    ).toHaveLength(1);
    expect(
      driverStates.filter((route) => route.status === "Requested"),
    ).toHaveLength(1);
    const driverLoser =
      driverResults[0].status() === 409
        ? driverAssignments[0].dialog
        : driverAssignments[1].dialog;
    await expect(
      driverLoser.getByText(
        "This assignment conflicts with existing bookings or accessibility requirements.",
      ),
    ).toBeVisible();
    await driverLoser
      .getByRole("button", { name: "Nevermind", exact: true })
      .click();

    const vehicleAssignments = [
      await openScheduleModal(adminA, routes[2]),
      await openScheduleModal(adminB, routes[3]),
    ];
    await selectModalAssignment(
      adminA,
      vehicleAssignments[0].dialog,
      driverA,
      sharedVehicle,
    );
    await selectModalAssignment(
      adminB,
      vehicleAssignments[1].dialog,
      driverB,
      sharedVehicle,
    );

    const vehicleResponses = [
      adminA.waitForResponse((r) => r.url().endsWith("/api/routes/schedule")),
      adminB.waitForResponse((r) => r.url().endsWith("/api/routes/schedule")),
    ];
    await Promise.all([
      vehicleAssignments[0].dialog
        .getByRole("button", { name: "Save", exact: true })
        .click(),
      vehicleAssignments[1].dialog
        .getByRole("button", { name: "Save", exact: true })
        .click(),
    ]);
    const vehicleResults = await Promise.all(vehicleResponses);
    expect(vehicleResults.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);

    const vehicleStates = await Promise.all(
      routes.slice(2).map((routeId) => routeState(adminApi, routeId)),
    );
    expect(
      vehicleStates.filter((route) => route.status === "Scheduled"),
    ).toHaveLength(1);
    expect(
      vehicleStates.filter((route) => route.status === "Requested"),
    ).toHaveLength(1);
    const vehicleLoser =
      vehicleResults[0].status() === 409
        ? vehicleAssignments[0].dialog
        : vehicleAssignments[1].dialog;
    await expect(
      vehicleLoser.getByText(
        "This assignment conflicts with existing bookings or accessibility requirements.",
      ),
    ).toBeVisible();

    expect(diag.apiFailures).toHaveLength(2);
    expect(diag.apiFailures.every(({ status }) => status === 409)).toBe(true);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
