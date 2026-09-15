/**
 * The ride flow, UI-agnostic. Every step is an HTTP call; if this is red the
 * backend is broken regardless of what the pages do.
 *
 *   student  POST /api/routes           Requested
 *   admin    POST /api/routes/schedule  Scheduled
 *   driver   POST /api/routes/start     En-route
 *   driver   POST /api/routes/pickup    Pickedup
 *   driver   POST /api/routes/complete  Completed
 */
import { test, expect } from "./fixtures";
import { PERSONAS, LOCATIONS, VEHICLE } from "./seed";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

test("ride: request → schedule → start → pickup → dropoff", async ({
  apiAs,
}) => {
  const student = await apiAs("student");
  const admin = await apiAs("admin");
  const driver = await apiAs("driver");

  // Different locations from the UI flow so the two never look alike in the admin table.
  const pickup = new Date(Date.now() + 48 * HOUR);
  const create = await student.post("/api/routes", {
    data: {
      pickupLocation: LOCATIONS.studentCenter.id,
      dropoffLocation: LOCATIONS.techSquare.id,
      scheduledPickupTime: pickup.toISOString(),
      pickupWindowStart: new Date(pickup.getTime() - 30 * MINUTE).toISOString(),
      pickupWindowEnd: new Date(pickup.getTime() + 30 * MINUTE).toISOString(),
    },
  });
  expect(create.status(), await create.text()).toBe(201);
  const { _id: routeId, status } = (await create.json()) as {
    _id: string;
    status: string;
  };
  expect(status).toBe("Requested");

  const step = async (
    who: typeof driver,
    path: string,
    body: Record<string, string>,
    expected: string,
  ) => {
    const res = await who.post(path, { data: body });
    expect(res.status(), `${path}: ${await res.text()}`).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe(expected);
  };

  await step(
    admin,
    "/api/routes/schedule",
    { routeId, driverId: PERSONAS.driver.id, vehicleId: VEHICLE.id },
    "Scheduled",
  );
  await step(driver, "/api/routes/start", { routeId }, "En-route");
  await step(driver, "/api/routes/pickup", { routeId }, "Pickedup");
  await step(driver, "/api/routes/complete", { routeId }, "Completed");

  // The student sees the finished ride.
  const readBack = await student.get(`/api/routes?id=${routeId}`);
  expect(readBack.status()).toBe(200);
  expect(((await readBack.json()) as { status: string }).status).toBe(
    "Completed",
  );
});
