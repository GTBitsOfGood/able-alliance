/**
 * Route A, UI-agnostic. Student creates a ride, admin schedules it, then
 * student / admin / driver lists agree on status and assignment.
 *
 * Stops at Scheduled — the full lifecycle (start → pickup → dropoff) lives
 * in ride.api.spec.ts.
 */
import { test, expect } from "./fixtures";
import { PERSONAS, LOCATIONS, VEHICLE } from "./seed";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

type Embedded = { _id: string; firstName?: string; lastName?: string };
type RouteJson = {
  _id: string;
  status: string;
  pickupLocation: string;
  dropoffLocation: string;
  student?: Embedded | string;
  driver?: Embedded | string;
  vehicle?: { _id: string; name?: string; licensePlate?: string } | string;
};

function idOf(value: Embedded | string | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : String(value._id);
}

function asRoutes(body: unknown): RouteJson[] {
  return Array.isArray(body) ? (body as RouteJson[]) : [];
}

test("route A: student creates, admin schedules, lists stay consistent", async ({
  apiAs,
}) => {
  const student = await apiAs("student");
  const admin = await apiAs("admin");
  const driver = await apiAs("driver");

  // Distinct locations/time from ride.api.spec.ts so parallel runs don't collide.
  const pickup = new Date(Date.now() + 30 * HOUR);
  const create = await student.post("/api/routes", {
    data: {
      pickupLocation: LOCATIONS.exhibitionHall.id,
      dropoffLocation: LOCATIONS.studentCenter.id,
      scheduledPickupTime: pickup.toISOString(),
      pickupWindowStart: new Date(pickup.getTime() - 30 * MINUTE).toISOString(),
      pickupWindowEnd: new Date(pickup.getTime() + 30 * MINUTE).toISOString(),
    },
  });
  expect(create.status(), await create.text()).toBe(201);
  const created = (await create.json()) as RouteJson;
  const routeId = String(created._id);
  expect(created.status).toBe("Requested");

  const studentList = await student.get("/api/routes");
  expect(studentList.status()).toBe(200);
  const studentRide = asRoutes(await studentList.json()).find(
    (r) => String(r._id) === routeId,
  );
  expect(studentRide, "ride missing from student list").toBeTruthy();
  expect(studentRide!.status).toBe("Requested");
  expect(String(studentRide!.pickupLocation)).toBe(LOCATIONS.exhibitionHall.id);
  expect(String(studentRide!.dropoffLocation)).toBe(LOCATIONS.studentCenter.id);

  const adminList = await admin.get("/api/routes");
  expect(adminList.status()).toBe(200);
  const adminRide = asRoutes(await adminList.json()).find(
    (r) => String(r._id) === routeId,
  );
  expect(adminRide, "ride missing from admin list").toBeTruthy();
  expect(adminRide!.status).toBe("Requested");

  const scheduled = await admin.post("/api/routes/schedule", {
    data: {
      routeId,
      driverId: PERSONAS.driver.id,
      vehicleId: VEHICLE.id,
    },
  });
  expect(scheduled.status(), await scheduled.text()).toBe(200);
  expect(((await scheduled.json()) as RouteJson).status).toBe("Scheduled");

  const driverList = await driver.get(
    `/api/routes?driver=${PERSONAS.driver.id}`,
  );
  expect(driverList.status()).toBe(200);
  const driverRide = asRoutes(await driverList.json()).find(
    (r) => String(r._id) === routeId,
  );
  expect(driverRide, "ride missing from driver list").toBeTruthy();
  expect(driverRide!.status).toBe("Scheduled");
  expect(idOf(driverRide!.driver)).toBe(PERSONAS.driver.id);
  expect(idOf(driverRide!.vehicle)).toBe(VEHICLE.id);

  const readBack = await student.get(`/api/routes?id=${routeId}`);
  expect(readBack.status()).toBe(200);
  const studentView = (await readBack.json()) as RouteJson;
  expect(studentView.status).toBe("Scheduled");
  expect(idOf(studentView.driver)).toBe(PERSONAS.driver.id);
  expect(idOf(studentView.vehicle)).toBe(VEHICLE.id);
});
