/**
 * The same ride flow, through the pages. Sessions are minted, so CAS is not
 * involved. Red here + green in ride.api.spec.ts = frontend problem; the
 * "diagnostics" attachment on the failed test says which request or error.
 *
 *   student  /rides/new          fills the form            Requested
 *   admin    /admin?tab=Rides    assigns driver + vehicle  Scheduled
 *   driver   /rides/:id          Start ride                En-route
 *   driver   /rides/:id          Student picked up         Pickedup
 *   driver   /rides/:id          Student dropped off       Completed
 *   student  /rides/:id          sees Completed
 */
import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { PERSONAS, LOCATIONS, VEHICLE } from "./seed";

/** TimeInput is a text box with a listbox; typing then Enter commits the first match. */
async function pickTime(input: ReturnType<Page["locator"]>, label: string) {
  await input.fill(label);
  await input.press("Enter");
  await expect(input).toHaveValue(label);
}

test("ride: request → schedule → start → pickup → dropoff (UI)", async ({
  pageAs,
  diag,
}) => {
  test.setTimeout(120_000);

  const student = await pageAs("student");

  // ── Student requests a ride ────────────────────────────────────────────
  await student.goto("/rides/new");
  await expect(
    student.getByRole("heading", { name: "Create Ride" }),
  ).toBeVisible();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (tomorrow.getMonth() !== new Date().getMonth()) {
    // Calendar header: [prev][month/year][next]; the nav buttons are the only icon buttons.
    await student.locator('button[type="button"]:has(svg)').nth(1).click();
  }
  await student
    .getByRole("button", { name: String(tomorrow.getDate()), exact: true })
    .click();

  const times = student.getByPlaceholder("hh:mm");
  await pickTime(times.nth(0), "10:00 AM");
  await pickTime(student.locator("#pickup-window-from"), "9:30 AM");
  await pickTime(student.locator("#pickup-window-to"), "10:30 AM");

  const selects = student.locator("select");
  await selects.nth(0).selectOption({ label: LOCATIONS.exhibitionHall.name });
  await selects.nth(1).selectOption({ label: LOCATIONS.techSquare.name });

  const created = student.waitForResponse(
    (r) => r.url().endsWith("/api/routes") && r.request().method() === "POST",
  );
  await student.getByRole("button", { name: "Submit" }).click();
  const createRes = await created;
  expect(createRes.status(), await createRes.text()).toBe(201);
  const { _id: routeId } = (await createRes.json()) as { _id: string };
  await expect(student).toHaveURL(/\/rides$/);

  // ── Admin schedules it ─────────────────────────────────────────────────
  const admin = await pageAs("admin");
  await admin.goto("/admin?tab=Rides");
  const row = admin
    .getByRole("row")
    .filter({ hasText: PERSONAS.student.lastName })
    .filter({ hasText: LOCATIONS.exhibitionHall.name });
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

  // ── Driver runs the ride ───────────────────────────────────────────────
  const driver = await pageAs("driver");
  await driver.goto(`/rides/${routeId}`);
  const chip = driver
    .getByRole("heading", { name: "Ride Details" })
    .locator("xpath=following-sibling::span[1]");
  await expect(chip).toHaveText("Scheduled");

  await driver.getByRole("button", { name: "Start ride" }).click();
  await expect(chip).toHaveText("En-route");
  await driver.getByRole("button", { name: "Student picked up" }).click();
  await expect(chip).toHaveText("Pickedup");
  await driver.getByRole("button", { name: "Student dropped off" }).click();
  await expect(chip).toHaveText("Completed");

  // ── Student sees the result ────────────────────────────────────────────
  await student.goto(`/rides/${routeId}`);
  await expect(
    student
      .getByRole("heading", { name: "Ride Details" })
      .locator("xpath=following-sibling::span[1]"),
  ).toHaveText("Completed");

  expect(diag.apiFailures, diag.summary()).toHaveLength(0);
});
