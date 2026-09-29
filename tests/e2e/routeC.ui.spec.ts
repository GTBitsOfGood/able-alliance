/**
 * Route C through the pages. The ride is created by API setup so the UI test
 * can focus on the student confirmation dialog and admin requested-rides view.
 */
import { test, expect } from "./fixtures";
import { LOCATIONS } from "./seed";
import { createRequestedRide, expectRouteStatus } from "./routeTestHelpers";

test("route C: student cancellation requires confirmation (UI)", async ({
  apiAs,
  pageAs,
  diag,
}) => {
  test.setTimeout(90_000);

  const studentApi = await apiAs("student");
  const adminApi = await apiAs("admin");
  const created = await createRequestedRide(studentApi, {
    pickupLocation: LOCATIONS.studentCenter.id,
    dropoffLocation: LOCATIONS.exhibitionHall.id,
    hoursFromNow: 55,
  });
  const routeId = created._id;

  const admin = await pageAs("admin");
  await admin.goto("/admin?tab=Rides");
  const adminRow = admin
    .getByRole("row")
    .filter({ hasText: LOCATIONS.studentCenter.name })
    .filter({ hasText: LOCATIONS.exhibitionHall.name });
  await expect(adminRow).toHaveCount(1);

  const student = await pageAs("student");
  await student.goto(`/rides/${routeId}`);
  const chip = student
    .getByRole("heading", { name: "Ride Details" })
    .locator("xpath=following-sibling::span[1]");
  await expect(chip).toHaveText("Requested");

  await student.getByRole("button", { name: "Cancel ride" }).click();
  await expect(
    student.getByText("Are you sure you want to cancel this ride?"),
  ).toBeVisible();
  await student.getByRole("button", { name: "Nevermind" }).click();
  await expect(
    student.getByText("Are you sure you want to cancel this ride?"),
  ).toBeHidden();
  await expect(chip).toHaveText("Requested");

  await student.getByRole("button", { name: "Cancel ride" }).click();
  const cancelled = student.waitForResponse((r) =>
    r.url().endsWith("/api/routes/cancel"),
  );
  await student
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel ride" })
    .click();
  const cancelRes = await cancelled;
  expect(cancelRes.status(), await cancelRes.text()).toBe(200);
  await expect(student).toHaveURL(/\/rides$/);

  await student.goto(`/rides/${routeId}`);
  await expect(
    student
      .getByRole("heading", { name: "Ride Details" })
      .locator("xpath=following-sibling::span[1]"),
  ).toHaveText("Cancelled by Student");
  await expect(
    student.getByRole("button", { name: "Cancel ride" }),
  ).toBeHidden();

  await admin.reload();
  await expect(adminRow).toHaveCount(0);
  await expectRouteStatus(adminApi, routeId, "Cancelled by Student", "admin");

  expect(diag.apiFailures, diag.summary()).toHaveLength(0);
});
