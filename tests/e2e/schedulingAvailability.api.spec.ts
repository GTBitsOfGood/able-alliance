/**
 * Scheduling availability, UI-agnostic. Assignments honor driver shifts and
 * include travel time between consecutive rides.
 */
import { test, expect } from "./fixtures";
import { LOCATIONS } from "./seed";
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

test("scheduling availability: checks shifts and travel time", async ({
  apiAs,
  playwright,
}) => {
  const admin = await apiAs("admin");
  const firstPickup = futureSlot(31, "10:00");
  const driver = await createDriver(
    admin,
    "availabilitydriver",
    firstPickup,
    "10:00",
    "11:00",
  );
  const firstVehicle = await createVehicle(admin, "firstvehicle");
  const secondVehicle = await createVehicle(admin, "secondvehicle");
  const students = await Promise.all([
    createStudent(admin, "firststudent"),
    createStudent(admin, "secondstudent"),
    createStudent(admin, "offshiftstudent"),
  ]);
  const clients = await Promise.all(
    students.map((student) => studentApi(playwright, student)),
  );

  try {
    const firstRoute = await createRide(clients[0], firstPickup);
    const firstAssignment = await schedule(
      admin,
      firstRoute,
      driver.id,
      firstVehicle.id,
    );
    expect(firstAssignment.status(), await firstAssignment.text()).toBe(200);

    const tooSoon = new Date(firstPickup.getTime() + 6 * 60_000);
    const travelRoute = await createRide(clients[1], tooSoon, {
      pickup: LOCATIONS.exhibitionHall.id,
      dropoff: LOCATIONS.techSquare.id,
    });
    const travelConflict = await schedule(
      admin,
      travelRoute,
      driver.id,
      secondVehicle.id,
    );
    const travelBody = (await travelConflict.json()) as {
      details?: string[];
    };
    expect(travelConflict.status()).toBe(409);
    expect(travelBody.details?.join(" ")).toMatch(/already driving/i);
    expect((await routeState(admin, travelRoute)).status).toBe("Requested");

    const offShiftRoute = await createRide(clients[2], futureSlot(31, "12:00"));
    const offShift = await schedule(
      admin,
      offShiftRoute,
      driver.id,
      secondVehicle.id,
    );
    expect(offShift.status()).toBe(409);
    expect(await offShift.text()).toMatch(/not available/i);
    expect((await routeState(admin, offShiftRoute)).status).toBe("Requested");
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
