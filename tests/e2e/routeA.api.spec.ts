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

import type {
  AdminRouteResponse,
  DriverRouteDetailResponse,
  RouteResponse,
  StudentRouteResponse,
} from "@/utils/types/api";

function asRoutes(body: unknown): RouteResponse[] {
  return Array.isArray(body) ? (body as RouteResponse[]) : [];
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
  const created = (await create.json()) as StudentRouteResponse;
  const routeId = String(created.id);
  expect(created.status).toBe("Requested");
  expect(created.pickup).toEqual(LOCATIONS.exhibitionHall);
  expect(created.dropoff).toEqual(LOCATIONS.studentCenter);

  const studentList = await student.get("/api/routes");
  expect(studentList.status()).toBe(200);
  const studentRide = asRoutes(await studentList.json()).find(
    (r) => String(r.id) === routeId,
  );
  expect(studentRide, "ride missing from student list").toBeTruthy();
  expect(studentRide!.status).toBe("Requested");
  expect(String(studentRide!.pickupLocation)).toBe(LOCATIONS.exhibitionHall.id);
  expect(String(studentRide!.dropoffLocation)).toBe(LOCATIONS.studentCenter.id);
  expect(studentRide!.student).not.toHaveProperty("settings");

  const adminList = await admin.get("/api/routes");
  expect(adminList.status()).toBe(200);
  const adminRide = asRoutes(await adminList.json()).find(
    (r) => String(r.id) === routeId,
  );
  expect(adminRide, "ride missing from admin list").toBeTruthy();
  expect(adminRide!.status).toBe("Requested");
  expect(adminRide!.student).toHaveProperty("settings");

  const scheduled = await admin.post("/api/routes/schedule", {
    data: {
      routeId,
      driverId: PERSONAS.driver.id,
      vehicleId: VEHICLE.id,
    },
  });
  expect(scheduled.status(), await scheduled.text()).toBe(200);
  const scheduledResponse = (await scheduled.json()) as AdminRouteResponse;
  expect(scheduledResponse.status).toBe("Scheduled");
  expect(scheduledResponse.driver).toHaveProperty("shifts");

  // The live admin table relies on server-side status filtering.
  const requestedList = await admin.get("/api/routes?status=Requested");
  expect(requestedList.status()).toBe(200);
  const requestedRoutes = asRoutes(await requestedList.json());
  expect(requestedRoutes.every((route) => route.status === "Requested")).toBe(
    true,
  );
  expect(requestedRoutes.some((route) => route.id === routeId)).toBe(false);
  const scheduledList = await admin.get("/api/routes?status=Scheduled");
  expect(scheduledList.status()).toBe(200);
  expect(
    asRoutes(await scheduledList.json()).some((route) => route.id === routeId),
  ).toBe(true);
  expect((await admin.get("/api/routes?status=not-a-status")).status()).toBe(
    400,
  );

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
  expect(driverRide!.driver).toBeTruthy();
  expect(driverRide!.driver).not.toHaveProperty("shifts");
  expect(driverRide!.student).not.toHaveProperty("settings");

  const readBack = await student.get(`/api/routes?id=${routeId}`);
  expect(readBack.status()).toBe(200);
  const studentView = (await readBack.json()) as StudentRouteResponse;
  expect(studentView.status).toBe("Scheduled");
  expect(studentView.driver?.id).toBe(PERSONAS.driver.id);
  expect(studentView.vehicle?.id).toBe(VEHICLE.id);
  expect(studentView.driver).not.toHaveProperty("settings");

  const driverDetailResponse = await driver.get(`/api/routes?id=${routeId}`);
  expect(driverDetailResponse.status()).toBe(200);
  const driverView =
    (await driverDetailResponse.json()) as DriverRouteDetailResponse;
  expect(driverView.student.studentInfo).toBeTruthy();
  expect(driverView.student.studentInfo?.accessibilityNeeds).toEqual([]);
  expect(driverView.student).not.toHaveProperty("settings");
  expect(driverView.driver).toBeTruthy();
  expect(driverView.driver).not.toHaveProperty("shifts");

  const shift = await admin.get(
    `/api/shifts/${PERSONAS.driver.id}?date=${estDateKey(pickup)}`,
  );
  expect(shift.status(), await shift.text()).toBe(200);
  const scheduledRoutes: AdminRouteResponse[] = (await shift.json())
    .scheduledRoutes;
  const adminShiftRoute = scheduledRoutes.find((route) => route.id === routeId);
  expect(adminShiftRoute).toBeTruthy();
  expect(adminShiftRoute!.status).toBe(studentView.status);
  expect(adminShiftRoute!.driver?.id).toBe(studentView.driver?.id);
  expect(adminShiftRoute!.vehicle?.id).toBe(studentView.vehicle?.id);

  const messages = await student.get(`/api/routes/${routeId}/messages`);
  expect(messages.status(), await messages.text()).toBe(200);
  expect(await messages.json()).toEqual([]);

  const deleted = await admin.delete(`/api/routes/${routeId}`);
  expect(deleted.status(), await deleted.text()).toBe(200);
  expect((await student.get(`/api/routes/${routeId}/messages`)).status()).toBe(
    404,
  );
});
