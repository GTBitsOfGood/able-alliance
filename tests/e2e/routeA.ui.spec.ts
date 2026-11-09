/**
 * Route A through the pages. Sessions are minted, so CAS is not involved.
 *
 *   student  /rides/new          fills the form            Requested
 *   student  /rides              ride is in this/next week
 *   admin    /admin/rides    assigns driver + vehicle  Scheduled
 *   driver   /rides/:id          scheduled ride is visible
 *   student  /rides/:id          scheduled driver/vehicle
 *
 * Stops at Scheduled — the full lifecycle lives in routeB.ui.spec.ts.
 */
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { PERSONAS, LOCATIONS, VEHICLE } from "./seed";
import {
  clearLocations,
  estDateDaysFromNow,
  nextServiceDate,
  selectLocation,
  scheduleRideInAdmin,
  showCalendarMonth,
} from "./routeTestHelpers";

const PICKUP = LOCATIONS.techSquare;
const DROPOFF = LOCATIONS.studentCenter;
const PICKUP_TIME = "2:00 PM";

/** TimeInput is a text box with a listbox; typing then Enter commits the first match. */
async function pickTime(input: ReturnType<Page["locator"]>, label: string) {
  await input.fill(label);
  await input.press("Enter");
  await expect(input).toHaveValue(label);
}

test("route A: student creates, admin schedules (UI)", async ({
  pageAs,
  diag,
}) => {
  test.setTimeout(90_000);

  const student = await pageAs("student");

  // ── Student requests a ride ────────────────────────────────────────────
  await student.goto("/rides/new");
  await expect(
    student.getByRole("heading", { name: "Request Ride" }),
  ).toBeVisible();

  const today = estDateDaysFromNow(0);
  const rideDate = nextServiceDate();
  await showCalendarMonth(student, rideDate);
  await student
    .getByRole("button", { name: String(rideDate.getDate()), exact: true })
    .click();

  const times = student.getByPlaceholder("hh:mm");
  await pickTime(times.nth(0), PICKUP_TIME);
  await pickTime(student.locator("#pickup-window-from"), "1:30 PM");
  await pickTime(student.locator("#pickup-window-to"), "2:30 PM");

  await clearLocations(student);
  await selectLocation(student, "Pickup location", PICKUP.name);
  await selectLocation(student, "Dropoff location", DROPOFF.name);

  const created = student.waitForResponse(
    (r) => r.url().endsWith("/api/routes") && r.request().method() === "POST",
  );
  await student.getByRole("button", { name: "Submit" }).click();
  const createRes = await created;
  expect(createRes.status(), await createRes.text()).toBe(201);
  const { id: routeId } = (await createRes.json()) as { id: string };
  await expect(student).toHaveURL(/\/rides$/);

  // Weeks start on Sunday; a lower weekday means the ride is in next week.
  const upcoming = student.getByRole("region", { name: "Upcoming Rides" });
  if (rideDate.getDay() <= today.getDay()) {
    await upcoming
      .getByRole("navigation", { name: "Browse rides by week" })
      .getByRole("button", { name: "Next week", exact: true })
      .click();
  }

  const studentCard = upcoming.getByTestId("ride-card").filter({
    hasText: PICKUP_TIME,
  });
  await expect(studentCard).toHaveCount(1);
  await expect(
    studentCard.getByText("Requested", { exact: true }),
  ).toBeVisible();

  // ── Admin sees it and schedules ────────────────────────────────────────
  const admin = await pageAs("admin");
  await admin.goto("/admin/rides");
  await scheduleRideInAdmin(admin, routeId);

  // ── Driver sees the scheduled ride ─────────────────────────────────────
  const driver = await pageAs("driver");
  await driver.goto("/rides");
  const schedule = driver.getByRole("region", {
    name: "Driver ride schedule",
  });
  if (rideDate.getDay() <= today.getDay()) {
    await schedule
      .getByRole("navigation", { name: "Browse rides by week" })
      .getByRole("button", { name: "Next week", exact: true })
      .click();
  }
  // The week list shows every day; other specs reuse these locations in the
  // reverse direction, so match the time too.
  const driverCard = schedule
    .getByTestId("ride-card")
    .filter({ hasText: PICKUP_TIME })
    .filter({ hasText: PICKUP.name })
    .filter({ hasText: DROPOFF.name });
  await expect(driverCard).toHaveCount(1);
  await expect(
    driverCard.getByText("Scheduled", { exact: true }),
  ).toBeVisible();
  await driver.goto(`/rides/${routeId}`);
  await expect(
    driver
      .getByRole("heading", { name: "Ride Details" })
      .locator("xpath=following-sibling::span[1]"),
  ).toHaveText("Scheduled");

  // ── Student sees scheduled assignment ──────────────────────────────────
  await student.goto(`/rides/${routeId}`);
  await expect(
    student
      .getByRole("heading", { name: "Ride Details" })
      .locator("xpath=following-sibling::span[1]"),
  ).toHaveText("Scheduled");
  await expect(student.getByText(PICKUP.name)).toBeVisible();
  await expect(student.getByText(DROPOFF.name)).toBeVisible();
  await expect(student.getByText(VEHICLE.name)).toBeVisible();
  await expect(student.getByText(VEHICLE.licensePlate)).toBeVisible();
  await expect(
    student.getByText(
      `${PERSONAS.driver.firstName} ${PERSONAS.driver.lastName}`,
    ),
  ).toBeVisible();

  expect(diag.apiFailures, diag.summary()).toHaveLength(0);
});
