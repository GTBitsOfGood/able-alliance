import type { APIRequestContext } from "@playwright/test";
import { addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { expect } from "./fixtures";
import { PERSONAS, VEHICLE } from "./seed";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

export type RouteJson = {
  _id: string;
  status: string;
  pickupLocation: string;
  dropoffLocation: string;
  scheduledPickupTime: string;
};

export function estDateDaysFromNow(days: number): Date {
  return addDays(toZonedTime(new Date(), "America/New_York"), days);
}

export function nextServiceDate(): Date {
  let offset = 1;
  let date = estDateDaysFromNow(offset);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date = estDateDaysFromNow(++offset);
  }
  return date;
}

export function formatEstTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

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
