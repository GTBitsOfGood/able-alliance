/**
 * Route E, UI-agnostic. Driver marks an en-route ride as no-show; the Missing
 * state is visible to student, driver, and admin.
 */
import { test, expect } from "./fixtures";
import { LOCATIONS } from "./seed";
import {
  createRequestedRide,
  expectRouteStatus,
  scheduleRide,
} from "./routeTestHelpers";

test("route E: driver marks student as no-show", async ({ apiAs }) => {
  const student = await apiAs("student");
  const admin = await apiAs("admin");
  const driver = await apiAs("driver");

  const created = await createRequestedRide(student, {
    pickupLocation: LOCATIONS.exhibitionHall.id,
    dropoffLocation: LOCATIONS.studentCenter.id,
    hoursFromNow: 56,
  });
  const routeId = created._id;

  await scheduleRide(admin, routeId);

  const started = await driver.post("/api/routes/start", { data: { routeId } });
  expect(started.status(), await started.text()).toBe(200);
  expect(((await started.json()) as { status: string }).status).toBe(
    "En-route",
  );

  const missing = await driver.post("/api/routes/missing", {
    data: { routeId },
  });
  expect(missing.status(), await missing.text()).toBe(200);
  expect(((await missing.json()) as { status: string }).status).toBe("Missing");

  await expectRouteStatus(student, routeId, "Missing", "student");
  await expectRouteStatus(driver, routeId, "Missing", "driver");
  await expectRouteStatus(admin, routeId, "Missing", "admin");

  const pickup = await driver.post("/api/routes/pickup", { data: { routeId } });
  expect(pickup.status(), await pickup.text()).toBe(404);
});
