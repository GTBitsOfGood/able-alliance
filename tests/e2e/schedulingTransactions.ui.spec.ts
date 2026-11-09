/**
 * Scheduling transactions through the pages. A stale auto-schedule plan fails
 * as one batch and the UI reports that nothing was booked.
 */
import { formatInTimeZone } from "date-fns-tz";
import { test, expect } from "./fixtures";
import {
  createDriver,
  createRide,
  createStudent,
  createVehicle,
  futureSlot,
  routeState,
  routeUpdateAuditCount,
  studentApi,
} from "./schedulingTestHelpers";

const TZ = "America/New_York";

test("scheduling transactions: stale plan leaves no partial changes (UI)", async ({
  apiAs,
  pageAs,
  playwright,
  diag,
}) => {
  test.setTimeout(90_000);

  const adminApi = await apiAs("admin");
  const pickup = futureSlot(39, "10:00");
  await createDriver(adminApi, "uitransactiondriver", pickup);
  await createVehicle(adminApi, "uitransactionvehicle");
  const students = await Promise.all([
    createStudent(adminApi, "uivalidbatchstudent"),
    createStudent(adminApi, "uicancelledbatchstudent"),
  ]);
  const clients = await Promise.all(
    students.map((student) => studentApi(playwright, student)),
  );

  try {
    const validRoute = await createRide(clients[0], pickup);
    const cancelledRoute = await createRide(
      clients[1],
      futureSlot(39, "14:00"),
    );
    const date = formatInTimeZone(pickup, TZ, "yyyy-MM-dd");

    const admin = await pageAs("admin");
    await admin.goto("/admin/auto-schedule");
    await admin.locator('input[type="date"]').fill(date);
    const generated = admin.waitForResponse(
      (response) =>
        response.url().includes(`/api/routes/auto-schedule?date=${date}`) &&
        response.request().method() === "GET",
    );
    await admin.getByRole("button", { name: "Generate schedule" }).click();
    const generateResponse = await generated;
    expect(generateResponse.status(), await generateResponse.text()).toBe(200);
    await expect(
      admin.getByRole("button", { name: "Apply 2 assignments" }),
    ).toBeEnabled();

    const cancellation = await clients[1].post("/api/routes/cancel", {
      data: { routeId: cancelledRoute },
    });
    expect(cancellation.status(), await cancellation.text()).toBe(200);
    const auditBefore = await routeUpdateAuditCount(adminApi, [
      validRoute,
      cancelledRoute,
    ]);

    const applied = admin.waitForResponse(
      (response) =>
        response.url().endsWith("/api/routes/auto-schedule") &&
        response.request().method() === "POST",
    );
    await admin.getByRole("button", { name: "Apply 2 assignments" }).click();
    const applyResponse = await applied;
    expect(applyResponse.status(), await applyResponse.text()).toBe(409);
    await expect(
      admin.getByRole("alert").getByText(/Nothing was booked:/),
    ).toBeVisible();

    expect(await routeState(adminApi, validRoute)).toMatchObject({
      status: "Requested",
      driver: null,
      vehicle: null,
    });
    expect((await routeState(adminApi, cancelledRoute)).status).toBe(
      "CancelledByStudent",
    );
    expect(
      await routeUpdateAuditCount(adminApi, [validRoute, cancelledRoute]),
    ).toBe(auditBefore);
    expect(diag.apiFailures).toHaveLength(1);
    expect(diag.apiFailures[0].status).toBe(409);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
