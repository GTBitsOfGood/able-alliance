/**
 * Route B through the pages. Sessions are minted, so CAS is not involved.
 * Red here + green in routeB.api.spec.ts = frontend problem; the "diagnostics"
 * attachment on the failed test says which request or error.
 *
 *   student  /rides/new          fills the form            Requested
 *   admin    /admin?tab=Rides    assigns driver + vehicle  Scheduled
 *   driver   /rides/:id          Start ride                En-route
 *   driver   /rides/:id          Student picked up         Picked up
 *   driver   /rides/:id          Student dropped off       Completed
 *   student  /rides/:id          sees Completed
 */
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { LOCATIONS } from "./seed";
import {
  clearLocations,
  nextServiceDate,
  selectLocation,
  scheduleRideInAdmin,
  showCalendarMonth,
} from "./routeTestHelpers";

/** TimeInput is a text box with a listbox; typing then Enter commits the first match. */
async function pickTime(input: ReturnType<Page["locator"]>, label: string) {
  await input.fill(label);
  await input.press("Enter");
  await expect(input).toHaveValue(label);
}

test("route B: driver start → pickup → dropoff (UI)", async ({
  pageAs,
  diag,
}) => {
  test.setTimeout(120_000);

  const student = await pageAs("student");

  // ── Student requests a ride ────────────────────────────────────────────
  await student.goto("/rides/new");
  await expect(
    student.getByRole("heading", { name: "Request Ride" }),
  ).toBeVisible();

  const rideDate = nextServiceDate();
  await showCalendarMonth(student, rideDate);
  await student
    .getByRole("button", { name: String(rideDate.getDate()), exact: true })
    .click();

  const times = student.getByPlaceholder("hh:mm");
  await pickTime(times.nth(0), "10:00 AM");
  await pickTime(student.locator("#pickup-window-from"), "9:30 AM");
  await pickTime(student.locator("#pickup-window-to"), "10:30 AM");

  await clearLocations(student);
  await selectLocation(
    student,
    "Pickup location",
    LOCATIONS.exhibitionHall.name,
  );
  await selectLocation(student, "Dropoff location", LOCATIONS.techSquare.name);

  const created = student.waitForResponse(
    (r) => r.url().endsWith("/api/routes") && r.request().method() === "POST",
  );
  await student.getByRole("button", { name: "Submit" }).click();
  const createRes = await created;
  expect(createRes.status(), await createRes.text()).toBe(201);
  const { id: routeId } = (await createRes.json()) as { id: string };
  await expect(student).toHaveURL(/\/rides$/);

  // ── Admin schedules it ─────────────────────────────────────────────────
  const admin = await pageAs("admin");
  await admin.goto("/admin?tab=Rides");
  await scheduleRideInAdmin(admin, routeId);

  // ── Driver runs the ride ───────────────────────────────────────────────
  const driver = await pageAs("driver");
  await driver.goto(`/rides/${routeId}`);
  const chip = driver
    .getByRole("heading", { name: "Ride Details" })
    .locator("xpath=following-sibling::span[1]");
  await expect(chip).toHaveText("Scheduled");

  await driver.getByRole("button", { name: "Start ride" }).click();
  await expect(chip).toHaveText("En-route");
  await expect(
    driver.getByRole("button", { name: "Student picked up" }),
  ).toBeVisible();
  await expect(
    driver.getByRole("button", { name: "Student no-show" }),
  ).toBeVisible();
  await driver.getByRole("button", { name: "Student picked up" }).click();
  const pickupDialog = driver.getByRole("dialog");
  await expect(
    pickupDialog.getByRole("heading", { name: "Student Picked Up" }),
  ).toBeVisible();
  await pickupDialog.getByRole("button", { name: "Confirm Pickup" }).click();
  await expect(chip).toHaveText("Picked up");
  await expect(
    driver.getByRole("button", { name: "Student dropped off" }),
  ).toBeVisible();
  await driver.getByRole("button", { name: "Student dropped off" }).click();
  await expect(chip).toHaveText("Completed");
  await expect(
    driver.getByRole("button", { name: "Student dropped off" }),
  ).toBeHidden();

  // ── Student sees the result ────────────────────────────────────────────
  await student.goto(`/rides/${routeId}`);
  await expect(
    student
      .getByRole("heading", { name: "Ride Details" })
      .locator("xpath=following-sibling::span[1]"),
  ).toHaveText("Completed");

  expect(diag.apiFailures, diag.summary()).toHaveLength(0);
});
