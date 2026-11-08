/**
 * Scheduling concurrency through the pages. Two admins submit overlapping
 * assignments together; one succeeds and the other keeps its row with an error.
 */
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import {
  createDriver,
  createRide,
  createStudent,
  createVehicle,
  futureSlot,
  routeState,
  studentApi,
  type TestUser,
  type TestVehicle,
} from "./schedulingTestHelpers";

async function selectAssignment(
  page: Page,
  row: Locator,
  driver: TestUser,
  vehicle: TestVehicle,
) {
  await row.getByText("Select driver").click();
  await page
    .getByRole("menuitem", {
      name: `${driver.lastName}, ${driver.firstName}`,
      exact: true,
    })
    .evaluate((item: HTMLElement) => item.click());
  await row.getByText("Select vehicle").click();
  await page
    .getByRole("menuitem", {
      name: `${vehicle.name} (${vehicle.licensePlate})`,
      exact: true,
    })
    .evaluate((item: HTMLElement) => item.click());
}

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
      adminA.goto("/admin?tab=Rides"),
      adminB.goto("/admin?tab=Rides"),
    ]);

    const driverRows = [
      adminA.getByRole("row").filter({ hasText: students[0].lastName }),
      adminB.getByRole("row").filter({ hasText: students[1].lastName }),
    ];
    await expect(driverRows[0]).toHaveCount(1);
    await expect(driverRows[1]).toHaveCount(1);
    await selectAssignment(adminA, driverRows[0], driverA, vehicleA);
    await selectAssignment(adminB, driverRows[1], driverA, vehicleB);

    const driverResponses = [
      adminA.waitForResponse((r) => r.url().endsWith("/api/routes/schedule")),
      adminB.waitForResponse((r) => r.url().endsWith("/api/routes/schedule")),
    ];
    await Promise.all([
      driverRows[0].getByRole("button", { name: "Assign" }).click(),
      driverRows[1].getByRole("button", { name: "Assign" }).click(),
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
      driverResults[0].status() === 409 ? driverRows[0] : driverRows[1];
    await expect(
      driverLoser.getByText(
        "This assignment conflicts with existing bookings or accessibility requirements.",
      ),
    ).toBeVisible();

    const vehicleRows = [
      adminA.getByRole("row").filter({ hasText: students[2].lastName }),
      adminB.getByRole("row").filter({ hasText: students[3].lastName }),
    ];
    await selectAssignment(adminA, vehicleRows[0], driverA, sharedVehicle);
    await selectAssignment(adminB, vehicleRows[1], driverB, sharedVehicle);

    const vehicleResponses = [
      adminA.waitForResponse((r) => r.url().endsWith("/api/routes/schedule")),
      adminB.waitForResponse((r) => r.url().endsWith("/api/routes/schedule")),
    ];
    await Promise.all([
      vehicleRows[0].getByRole("button", { name: "Assign" }).click(),
      vehicleRows[1].getByRole("button", { name: "Assign" }).click(),
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
      vehicleResults[0].status() === 409 ? vehicleRows[0] : vehicleRows[1];
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
