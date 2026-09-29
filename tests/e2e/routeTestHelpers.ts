import type { APIRequestContext } from "@playwright/test";
import { expect } from "./fixtures";
import { PERSONAS, VEHICLE } from "./seed";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export type RouteJson = {
  _id: string;
  status: string;
  pickupLocation: string;
  dropoffLocation: string;
};

export async function createRequestedRide(
  student: APIRequestContext,
  {
    pickupLocation,
    dropoffLocation,
    hoursFromNow,
  }: {
    pickupLocation: string;
    dropoffLocation: string;
    hoursFromNow: number;
  },
): Promise<RouteJson> {
  const pickup = new Date(Date.now() + hoursFromNow * HOUR);
  const res = await student.post("/api/routes", {
    data: {
      pickupLocation,
      dropoffLocation,
      scheduledPickupTime: pickup.toISOString(),
      pickupWindowStart: new Date(pickup.getTime() - 30 * MINUTE).toISOString(),
      pickupWindowEnd: new Date(pickup.getTime() + 30 * MINUTE).toISOString(),
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as RouteJson;
}

export async function scheduleRide(
  admin: APIRequestContext,
  routeId: string,
): Promise<RouteJson> {
  const res = await admin.post("/api/routes/schedule", {
    data: {
      routeId,
      driverId: PERSONAS.driver.id,
      vehicleId: VEHICLE.id,
    },
  });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as RouteJson;
}

export async function expectRouteStatus(
  who: APIRequestContext,
  routeId: string,
  expected: string,
  label: string,
) {
  const res = await who.get(`/api/routes?id=${routeId}`);
  const body = await res.text();
  expect(res.status(), `${label}: ${body}`).toBe(200);
  expect((JSON.parse(body) as RouteJson).status).toBe(expected);
}
