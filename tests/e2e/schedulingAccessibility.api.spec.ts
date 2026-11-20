/**
 * Scheduling accessibility, UI-agnostic. A wheelchair rider cannot be
 * assigned a vehicle without wheelchair accessibility.
 */
import { test, expect } from "./fixtures";
import {
  createDriver,
  createRide,
  createStudent,
  createVehicle,
  futureSlot,
  routeState,
  schedule,
  studentApi,
} from "./schedulingTestHelpers";

test("scheduling accessibility: rejects an inaccessible vehicle", async ({
  apiAs,
  playwright,
}) => {
  const admin = await apiAs("admin");
  const pickup = futureSlot(32, "11:00");
  const driver = await createDriver(admin, "accessdriver", pickup);
  const vehicle = await createVehicle(admin, "inaccessible", "None");
  const student = await createStudent(admin, "wheelchairstudent", [
    "Wheelchair",
  ]);
  const client = await studentApi(playwright, student);

  try {
    const routeId = await createRide(client, pickup);
    const response = await schedule(admin, routeId, driver.id, vehicle.id);
    const body = (await response.json()) as { details?: string[] };
    expect(response.status()).toBe(409);
    expect(body.details?.join(" ")).toMatch(/not wheelchair-accessible/i);
    expect(await routeState(admin, routeId)).toMatchObject({
      status: "Requested",
      driver: null,
      vehicle: null,
    });
  } finally {
    await client.dispose();
  }
});
