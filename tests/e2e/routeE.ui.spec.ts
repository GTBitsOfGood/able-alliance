/**
 * Route E through the pages. The driver can mark no-show only after starting
 * the ride, and the Missing state is reflected to the student.
 */
import { test, expect } from "./fixtures";
import { LOCATIONS } from "./seed";
import {
  createRequestedRide,
  expectRouteStatus,
  scheduleRide,
} from "./routeTestHelpers";

test("route E: driver marks student as no-show (UI)", async ({
  apiAs,
  pageAs,
  diag,
}) => {
  test.setTimeout(90_000);

  const studentApi = await apiAs("student");
  const adminApi = await apiAs("admin");
  const driverApi = await apiAs("driver");

  const created = await createRequestedRide(studentApi, {
    pickupLocation: LOCATIONS.exhibitionHall.id,
    dropoffLocation: LOCATIONS.studentCenter.id,
    hoursFromNow: 57,
  });
  const routeId = created._id;
  await scheduleRide(adminApi, routeId);

  const driver = await pageAs("driver");
  await driver.goto(`/rides/${routeId}`);
  const chip = driver
    .getByRole("heading", { name: "Ride Details" })
    .locator("xpath=following-sibling::span[1]");
  await expect(chip).toHaveText("Scheduled");
  await expect(
    driver.getByRole("button", { name: "Student no-show" }),
  ).toBeHidden();

  await driver.getByRole("button", { name: "Start ride" }).click();
  await expect(chip).toHaveText("En-route");
  await expect(
    driver.getByRole("button", { name: "Student no-show" }),
  ).toBeVisible();

  const missing = driver.waitForResponse((r) =>
    r.url().endsWith("/api/routes/missing"),
  );
  await driver.getByRole("button", { name: "Student no-show" }).click();
  const missingRes = await missing;
  expect(missingRes.status(), await missingRes.text()).toBe(200);
  await expect(chip).toHaveText("Missing");
  await expect(
    driver.getByRole("button", { name: "Student picked up" }),
  ).toBeHidden();
  await expect(
    driver.getByRole("button", { name: "Student no-show" }),
  ).toBeHidden();

  const student = await pageAs("student");
  await student.goto(`/rides/${routeId}`);
  await expect(
    student
      .getByRole("heading", { name: "Ride Details" })
      .locator("xpath=following-sibling::span[1]"),
  ).toHaveText("Missing");

  await expectRouteStatus(adminApi, routeId, "Missing", "admin");
  await expectRouteStatus(driverApi, routeId, "Missing", "driver");

  expect(diag.apiFailures, diag.summary()).toHaveLength(0);
});
