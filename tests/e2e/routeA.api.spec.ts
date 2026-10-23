/**
 * Route A, UI-agnostic. Student creates a ride, admin schedules it, then
 * student / admin / driver lists agree on status and assignment.
 *
 * Stops at Scheduled — the full lifecycle (start → pickup → dropoff) lives
 * in routeB.api.spec.ts.
 */
import { test, expect } from "./fixtures";
import { PERSONAS, LOCATIONS, VEHICLE } from "./seed";
import { estDateKey } from "@/utils/dateEst";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

import type { RouteResponse as RouteJson } from "@/utils/types/api";

function asRoutes(body: unknown): RouteJson[] {
  return Array.isArray(body) ? (body as RouteJson[]) : [];
}

test("route A: student creates, admin schedules, lists stay consistent", async ({
  apiAs,
}) => {
  const student = await apiAs("student");
  const admin = await apiAs("admin");
  const driver = await apiAs("driver");

  // Distinct locations/time from routeB.api.spec.ts so parallel runs don't collide.
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
  const routeId = String(created.id);
  expect(created.status).toBe("Requested");
  expect(created.pickup).toEqual(LOCATIONS.exhibitionHall);
  expect(created.dropoff).toEqual(LOCATIONS.studentCenter);
  expect(created.student.settings?.userId).toBe(PERSONAS.student.id);

  const studentList = await student.get("/api/routes");
  expect(studentList.status()).toBe(200);
  const studentRide = asRoutes(await studentList.json()).find(
    (r) => String(r.id) === routeId,
  );
  expect(studentRide, "ride missing from student list").toBeTruthy();
  expect(studentRide!.status).toBe("Requested");
  expect(String(studentRide!.pickupLocation)).toBe(LOCATIONS.exhibitionHall.id);
  expect(String(studentRide!.dropoffLocation)).toBe(LOCATIONS.studentCenter.id);

  const adminList = await admin.get("/api/routes");
  expect(adminList.status()).toBe(200);
  const adminRide = asRoutes(await adminList.json()).find(
    (r) => String(r.id) === routeId,
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
    (r) => String(r.id) === routeId,
  );
  expect(driverRide, "ride missing from driver list").toBeTruthy();
  expect(driverRide!.status).toBe("Scheduled");
  expect(driverRide!.driver?.id).toBe(PERSONAS.driver.id);
  expect(driverRide!.vehicle?.id).toBe(VEHICLE.id);

  const readBack = await student.get(`/api/routes?id=${routeId}`);
  expect(readBack.status()).toBe(200);
  const studentView = (await readBack.json()) as RouteJson;
  expect(studentView.status).toBe("Scheduled");
  expect(studentView.driver?.id).toBe(PERSONAS.driver.id);
  expect(studentView.vehicle?.id).toBe(VEHICLE.id);

  const shift = await admin.get(
    `/api/shifts/${PERSONAS.driver.id}?date=${estDateKey(pickup)}`,
  );
  expect(shift.status(), await shift.text()).toBe(200);
  const scheduledRoutes: RouteJson[] = (await shift.json()).scheduledRoutes;
  expect(scheduledRoutes.find((route) => route.id === routeId)).toEqual(
    studentView,
  );

  // Foreign keys preserve the referenced users, vehicle, and locations.
  for (const path of [
    `/api/users/${PERSONAS.student.id}`,
    `/api/users/${PERSONAS.driver.id}`,
    `/api/vehicles/${VEHICLE.id}`,
    `/api/locations/${LOCATIONS.exhibitionHall.id}`,
  ]) {
    const deleted = await admin.delete(path);
    expect(deleted.status(), `${path}: ${await deleted.text()}`).toBe(409);
  }
  const messages = await student.get(`/api/routes/${routeId}/messages`);
  expect(messages.status(), await messages.text()).toBe(200);
  expect(await messages.json()).toEqual([]);

  const deleted = await admin.delete(`/api/routes/${routeId}`);
  expect(deleted.status(), await deleted.text()).toBe(200);
  expect((await student.get(`/api/routes/${routeId}/messages`)).status()).toBe(
    404,
  );
});
