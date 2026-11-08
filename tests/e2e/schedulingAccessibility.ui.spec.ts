/**
 * Scheduling accessibility through the pages. An inaccessible assignment
 * shows an error and leaves the requested ride in the admin table.
 */
import { test, expect } from "./fixtures";
import {
  createDriver,
  createRide,
  createStudent,
  createVehicle,
  futureSlot,
  routeState,
  studentApi,
} from "./schedulingTestHelpers";

test("scheduling accessibility: rejected assignment stays visible (UI)", async ({
  apiAs,
  pageAs,
  playwright,
  diag,
}) => {
  test.setTimeout(90_000);

  const adminApi = await apiAs("admin");
  const pickup = futureSlot(37, "11:00");
  const driver = await createDriver(adminApi, "uiaccessdriver", pickup);
  const vehicle = await createVehicle(adminApi, "uiinaccessible", "None");
  const student = await createStudent(adminApi, "uiwheelchair", ["Wheelchair"]);
  const studentClient = await studentApi(playwright, student);

  try {
    const routeId = await createRide(studentClient, pickup);
    const admin = await pageAs("admin");
    await admin.goto("/admin?tab=Rides");

    const row = admin.getByRole("row").filter({ hasText: student.lastName });
    await expect(row).toHaveCount(1);

    await row.getByText("Select driver").click();
    await admin
      .getByRole("menuitem", {
        name: `${driver.lastName}, ${driver.firstName}`,
        exact: true,
      })
      .evaluate((item: HTMLElement) => item.click());
    await row.getByText("Select vehicle").click();
    await admin
      .getByRole("menuitem", {
        name: `${vehicle.name} (${vehicle.licensePlate})`,
        exact: true,
      })
      .evaluate((item: HTMLElement) => item.click());

    const rejected = admin.waitForResponse(
      (response) =>
        response.url().endsWith("/api/routes/schedule") &&
        response.request().method() === "POST",
    );
    await row.getByRole("button", { name: "Assign" }).click();
    const response = await rejected;
    expect(response.status(), await response.text()).toBe(409);
    await expect(
      row.getByText(
        "This assignment conflicts with existing bookings or accessibility requirements.",
      ),
    ).toBeVisible();
    await expect(row).toHaveCount(1);
    expect(await routeState(adminApi, routeId)).toMatchObject({
      status: "Requested",
      driver: null,
      vehicle: null,
    });
    expect(diag.apiFailures).toHaveLength(1);
    expect(diag.apiFailures[0].status).toBe(409);
  } finally {
    await studentClient.dispose();
  }
});
