/**
 * Scheduling concurrency, UI-agnostic. Concurrent assignments cannot book
 * the same driver or vehicle for overlapping rides.
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

test("scheduling concurrency: prevents driver and vehicle double-booking", async ({
  apiAs,
  playwright,
}) => {
  const admin = await apiAs("admin");
  const morning = futureSlot(30, "10:00");
  const afternoon = futureSlot(30, "15:00");
  const driverA = await createDriver(admin, "drivera", morning);
  const driverB = await createDriver(admin, "driverb", morning);
  const vehicleA = await createVehicle(admin, "vehiclea");
  const vehicleB = await createVehicle(admin, "vehicleb");
  const sharedVehicle = await createVehicle(admin, "sharedvehicle");
  const students = await Promise.all(
    ["studenta", "studentb", "studentc", "studentd"].map((label) =>
      createStudent(admin, label),
    ),
  );
  const clients = await Promise.all(
    students.map((student) => studentApi(playwright, student)),
  );

  try {
    const driverRaceRoutes = await Promise.all([
      createRide(clients[0], morning),
      createRide(clients[1], morning),
    ]);
    const driverRace = await Promise.all([
      schedule(admin, driverRaceRoutes[0], driverA.id, vehicleA.id),
      schedule(admin, driverRaceRoutes[1], driverA.id, vehicleB.id),
    ]);
    expect(driverRace.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    const driverStates = await Promise.all(
      driverRaceRoutes.map((routeId) => routeState(admin, routeId)),
    );
    expect(
      driverStates.filter((route) => route.status === "Scheduled"),
    ).toHaveLength(1);
    expect(
      driverStates.filter((route) => route.status === "Requested"),
    ).toHaveLength(1);

    const vehicleRaceRoutes = await Promise.all([
      createRide(clients[2], afternoon),
      createRide(clients[3], afternoon),
    ]);
    const vehicleRace = await Promise.all([
      schedule(admin, vehicleRaceRoutes[0], driverA.id, sharedVehicle.id),
      schedule(admin, vehicleRaceRoutes[1], driverB.id, sharedVehicle.id),
    ]);
    expect(vehicleRace.map((response) => response.status()).sort()).toEqual([
      200, 409,
    ]);
    const vehicleStates = await Promise.all(
      vehicleRaceRoutes.map((routeId) => routeState(admin, routeId)),
    );
    expect(
      vehicleStates.filter((route) => route.status === "Scheduled"),
    ).toHaveLength(1);
    expect(
      vehicleStates.filter((route) => route.status === "Requested"),
    ).toHaveLength(1);
  } finally {
    await Promise.all(clients.map((client) => client.dispose()));
  }
});
