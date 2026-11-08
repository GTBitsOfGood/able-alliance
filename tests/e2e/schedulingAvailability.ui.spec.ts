/**
 * Scheduling availability through the pages. The admin sees assignment errors
 * when a driver cannot travel between rides or is outside their shift.
 */
import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { LOCATIONS } from "./seed";
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

test("scheduling availability: shift and travel conflicts stay visible (UI)", async ({
  apiAs,
  pageAs,
  playwright,
  diag,
}) => {
  test.setTimeout(90_000);

  const adminApi = await apiAs("admin");
  const firstPickup = futureSlot(36, "10:00");
  const driver = await createDriver(
    adminApi,
    "uiavailabilitydriver",
    firstPickup,
    "10:00",
    "11:00",
  );
  const firstVehicle = await createVehicle(adminApi, "uifirstvehicle");
  const secondVehicle = await createVehicle(adminApi, "uisecondvehicle");
  const students = await Promise.all([
    createStudent(adminApi, "uifirststudent"),
    createStudent(adminApi, "uitravelstudent"),
    createStudent(adminApi, "uioffshiftstudent"),
  ]);
  const clients = await Promise.all(
    students.map((student) => studentApi(playwright, student)),
  );

  try {
    const firstRoute = await createRide(clients[0], firstPickup);
    const firstAssignment = await schedule(
      adminApi,
      firstRoute,
      driver.id,
      firstVehicle.id,
    );
    expect(firstAssignment.status(), await firstAssignment.text()).toBe(200);

    const travelRoute = await createRide(
      clients[1],
      new Date(firstPickup.getTime() + 6 * 60_000),
      {
        pickup: LOCATIONS.exhibitionHall.id,
        dropoff: LOCATIONS.techSquare.id,
      },
    );
    const offShiftRoute = await createRide(clients[2], futureSlot(36, "12:00"));

    const admin = await pageAs("admin");
    await admin.goto("/admin?tab=Rides");
    const travelRow = admin
      .getByRole("row")
      .filter({ hasText: students[1].lastName });
    const offShiftRow = admin
      .getByRole("row")
      .filter({ hasText: students[2].lastName });
    await expect(travelRow).toHaveCount(1);
    await expect(offShiftRow).toHaveCount(1);

    await selectAssignment(admin, travelRow, driver, secondVehicle);
    const travelResponse = admin.waitForResponse((r) =>
      r.url().endsWith("/api/routes/schedule"),
    );
    await travelRow.getByRole("button", { name: "Assign" }).click();
    expect((await travelResponse).status()).toBe(409);
    await expect(
      travelRow.getByText(
        "This assignment conflicts with existing bookings or accessibility requirements.",
      ),
    ).toBeVisible();

    await selectAssignment(admin, offShiftRow, driver, secondVehicle);
    const offShiftResponse = admin.waitForResponse((r) =>
      r.url().endsWith("/api/routes/schedule"),
    );
    await offShiftRow.getByRole("button", { name: "Assign" }).click();
    expect((await offShiftResponse).status()).toBe(409);
    await expect(
      offShiftRow.getByText(
        "Driver is not available during the scheduled time",
      ),
    ).toBeVisible();

    expect((await routeState(adminApi, travelRoute)).status).toBe("Requested");
    expect((await routeState(adminApi, offShiftRoute)).status).toBe(
      "Requested",
    );
    expect(diag.apiFailures).toHaveLength(2);
    expect(diag.apiFailures.every(({ status }) => status === 409)).toBe(true);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
