/**
 * Scheduling ride status through the pages. Stale requested rows cannot assign
 * rides that were cancelled or scheduled after the admin table loaded.
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
  schedule,
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

test("scheduling ride status: stale rows reject assignment (UI)", async ({
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
    await admin.goto("/admin?tab=Rides");

    const cancelledRow = admin
      .getByRole("row")
      .filter({ hasText: students[0].lastName });
    const scheduledRow = admin
      .getByRole("row")
      .filter({ hasText: students[1].lastName });
    await expect(cancelledRow).toHaveCount(1);
    await expect(scheduledRow).toHaveCount(1);

    const cancellation = await clients[0].post("/api/routes/cancel", {
      data: { routeId: cancelledRoute },
    });
    expect(cancellation.status(), await cancellation.text()).toBe(200);
    const firstAssignment = await schedule(
      adminApi,
      scheduledRoute,
      driver.id,
      vehicle.id,
    );
    expect(firstAssignment.status(), await firstAssignment.text()).toBe(200);

    await selectAssignment(admin, cancelledRow, driver, vehicle);
    const cancelledResponse = admin.waitForResponse((r) =>
      r.url().endsWith("/api/routes/schedule"),
    );
    await cancelledRow.getByRole("button", { name: "Assign" }).click();
    expect((await cancelledResponse).status()).toBe(409);
    await expect(
      cancelledRow.getByText("Route is no longer in Requested status"),
    ).toBeVisible();

    await selectAssignment(admin, scheduledRow, driver, vehicle);
    const scheduledResponse = admin.waitForResponse((r) =>
      r.url().endsWith("/api/routes/schedule"),
    );
    await scheduledRow.getByRole("button", { name: "Assign" }).click();
    expect((await scheduledResponse).status()).toBe(409);
    await expect(
      scheduledRow.getByText("Route is no longer in Requested status"),
    ).toBeVisible();

    expect((await routeState(adminApi, cancelledRoute)).status).toBe(
      "CancelledByStudent",
    );
    expect((await routeState(adminApi, scheduledRoute)).status).toBe(
      "Scheduled",
    );
    expect(diag.apiFailures).toHaveLength(2);
    expect(diag.apiFailures.every(({ status }) => status === 409)).toBe(true);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
