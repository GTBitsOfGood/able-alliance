/**
 * Route C, UI-agnostic. A student cancels an assigned ride; the cancelled
 * status is visible to every role, and the driver can no longer start it.
 */
import { test, expect } from "./fixtures";
import { LOCATIONS } from "./seed";
import {
  createRequestedRide,
  expectRouteStatus,
  scheduleRide,
} from "./routeTestHelpers";

test("route C: student cancels a scheduled ride", async ({ apiAs }) => {
  const student = await apiAs("student");
  const admin = await apiAs("admin");
  const driver = await apiAs("driver");

  const created = await createRequestedRide(student, {
    pickupLocation: LOCATIONS.studentCenter.id,
    dropoffLocation: LOCATIONS.exhibitionHall.id,
    hoursFromNow: 54,
  });
  const routeId = created._id;

  await scheduleRide(admin, routeId);

  const cancelled = await student.post("/api/routes/cancel", {
    data: { routeId },
  });
  expect(cancelled.status(), await cancelled.text()).toBe(200);
  expect(((await cancelled.json()) as { status: string }).status).toBe(
    "Cancelled by Student",
  );

  await expectRouteStatus(student, routeId, "Cancelled by Student", "student");
  await expectRouteStatus(driver, routeId, "Cancelled by Student", "driver");
  await expectRouteStatus(admin, routeId, "Cancelled by Student", "admin");

  const start = await driver.post("/api/routes/start", { data: { routeId } });
  expect(start.status(), await start.text()).toBe(404);
});
