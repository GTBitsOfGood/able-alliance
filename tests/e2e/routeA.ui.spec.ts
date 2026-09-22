/**
 * Route A through the pages. Sessions are minted, so CAS is not involved.
 *
 *   student  /rides/new          fills the form            Requested
 *   student  /rides              ride is in this/next week
 *   admin    /admin?tab=Rides    assigns driver + vehicle  Scheduled
 *   driver   /rides              Tomorrow tab shows it
 *   student  /rides/:id          scheduled driver/vehicle
 *
 * Stops at Scheduled — the full lifecycle lives in ride.ui.spec.ts.
 */
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { PERSONAS, LOCATIONS, VEHICLE } from "./seed";

const PICKUP = LOCATIONS.techSquare;
const DROPOFF = LOCATIONS.studentCenter;
const PICKUP_TIME = "2:00 PM";

/** TimeInput is a text box with a listbox; typing then Enter commits the first match. */
async function pickTime(input: ReturnType<Page["locator"]>, label: string) {
  await input.fill(label);
  await input.press("Enter");
  await expect(input).toHaveValue(label);
}

function isEstSaturday(): boolean {
  return (
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short",
    }).format(new Date()) === "Sat"
  );
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
    student.getByRole("heading", { name: "Create Ride" }),
  ).toBeVisible();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getMonth() !== new Date().getMonth()) {
    await student.locator('button[type="button"]:has(svg)').nth(1).click();
  }
  await student
    .getByRole("button", { name: String(tomorrow.getDate()), exact: true })
    .click();

  const times = student.getByPlaceholder("hh:mm");
  await pickTime(times.nth(0), PICKUP_TIME);
  await pickTime(student.locator("#pickup-window-from"), "1:30 PM");
  await pickTime(student.locator("#pickup-window-to"), "2:30 PM");

  const selects = student.locator("select");
  await selects.nth(0).selectOption({ label: PICKUP.name });
  await selects.nth(1).selectOption({ label: DROPOFF.name });

  const created = student.waitForResponse(
    (r) => r.url().endsWith("/api/routes") && r.request().method() === "POST",
  );
  await student.getByRole("button", { name: "Submit" }).click();
  const createRes = await created;
  expect(createRes.status(), await createRes.text()).toBe(201);
  const { _id: routeId } = (await createRes.json()) as { _id: string };
  await expect(student).toHaveURL(/\/rides$/);

  // Tomorrow is next week when today is Saturday (weeks start Sunday EST).
  if (isEstSaturday()) {
    await student.getByText("Next Week", { exact: true }).click();
  }

  const studentCard = student.getByTestId("ride-card").filter({
    hasText: PICKUP_TIME,
  });
  await expect(studentCard).toHaveCount(1);
  await expect(
    studentCard.getByText("Requested", { exact: true }),
  ).toBeVisible();

  // ── Admin sees it and schedules ────────────────────────────────────────
  const admin = await pageAs("admin");
  await admin.goto("/admin?tab=Rides");
  const row = admin
    .getByRole("row")
    .filter({ hasText: PERSONAS.student.lastName })
    .filter({ hasText: PICKUP.name })
    .filter({ hasText: DROPOFF.name })
    .filter({ hasText: PICKUP_TIME });
  await expect(row).toHaveCount(1);

  await row.getByText("Select driver").click();
  await admin
    .getByRole("menuitem", {
      name: `${PERSONAS.driver.lastName}, ${PERSONAS.driver.firstName}`,
    })
    .click();
  await row.getByText("Select vehicle").click();
  await admin
    .getByRole("menuitem", {
      name: `${VEHICLE.name} (${VEHICLE.licensePlate})`,
    })
    .click();

  const scheduled = admin.waitForResponse((r) =>
    r.url().endsWith("/api/routes/schedule"),
  );
  await row.getByRole("button", { name: "Assign" }).click();
  const scheduleRes = await scheduled;
  expect(scheduleRes.status(), await scheduleRes.text()).toBe(200);
  await expect(row).toHaveCount(0);

  // ── Driver sees it on Tomorrow ─────────────────────────────────────────
  const driver = await pageAs("driver");
  await driver.goto("/rides");
  await driver.getByText("Tomorrow", { exact: true }).click();
  const driverCard = driver
    .getByTestId("ride-card")
    .filter({ hasText: PICKUP.name })
    .filter({ hasText: DROPOFF.name });
  await expect(driverCard).toHaveCount(1);
  await expect(
    driverCard.getByText("Scheduled", { exact: true }),
  ).toBeVisible();

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
