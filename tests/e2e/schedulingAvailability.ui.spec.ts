/**
 * Scheduling availability through the pages. Drivers with travel conflicts or
 * an incompatible shift are excluded from the assignment modal.
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
  openScheduleModal,
  routeState,
  schedule,
  studentApi,
  type TestUser,
} from "./schedulingTestHelpers";

async function expectDriverUnavailable(
  page: Page,
  dialog: Locator,
  unavailable: TestUser,
  available: TestUser,
) {
  const driverSelect = dialog
    .getByRole("button", { name: "Select...", exact: true })
    .first();
  await expect(driverSelect).toBeEnabled();
  await driverSelect.click();
  await expect(
    page.getByRole("menuitem", {
      name: `${unavailable.lastName}, ${unavailable.firstName}`,
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", {
      name: `${available.lastName}, ${available.firstName}`,
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
}

test("scheduling availability: unavailable drivers are excluded (UI)", async ({
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
  const availableDriver = await createDriver(
    adminApi,
    "uiavailabledriver",
    firstPickup,
  );
  const firstVehicle = await createVehicle(adminApi, "uifirstvehicle");
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
      new Date(firstPickup.getTime() + 8 * 60_000),
      {
        pickup: LOCATIONS.exhibitionHall.id,
        dropoff: LOCATIONS.techSquare.id,
      },
    );
    const offShiftRoute = await createRide(clients[2], futureSlot(36, "12:00"));

    const admin = await pageAs("admin");
    await admin.goto("/admin/rides");

    const travelAssignment = await openScheduleModal(admin, travelRoute);
    await expectDriverUnavailable(
      admin,
      travelAssignment.dialog,
      driver,
      availableDriver,
    );
    await travelAssignment.dialog
      .getByRole("button", { name: "Nevermind", exact: true })
      .click();

    const offShiftAssignment = await openScheduleModal(admin, offShiftRoute);
    await expectDriverUnavailable(
      admin,
      offShiftAssignment.dialog,
      driver,
      availableDriver,
    );

    expect((await routeState(adminApi, travelRoute)).status).toBe("Requested");
    expect((await routeState(adminApi, offShiftRoute)).status).toBe(
      "Requested",
    );
    expect(diag.apiFailures).toHaveLength(0);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
