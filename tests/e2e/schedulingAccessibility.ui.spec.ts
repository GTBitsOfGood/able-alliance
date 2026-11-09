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
  openScheduleModal,
  routeState,
  selectModalAssignment,
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
    await admin.goto("/admin/rides");

    const { dialog, row } = await openScheduleModal(admin, routeId);
    await selectModalAssignment(admin, dialog, driver, vehicle);

    const rejected = admin.waitForResponse(
      (response) =>
        response.url().endsWith("/api/routes/schedule") &&
        response.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    const response = await rejected;
    expect(response.status(), await response.text()).toBe(409);
    await expect(
      dialog.getByText(
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
