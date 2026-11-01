import type { APIRequestContext, Page } from "@playwright/test";
import { addDays } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { expect } from "./fixtures";
import { PERSONAS, VEHICLE } from "./seed";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

import type {
  AdminRouteResponse,
  StudentRouteResponse,
} from "@/utils/types/api";

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

type LocationField = "Pickup location" | "Dropoff location";

/**
 * The location fields are SearchableSelects that hide whatever the other field
 * has selected, so clear both defaults before choosing specific locations.
 */
export async function clearLocations(page: Page) {
  for (const field of ["Pickup location", "Dropoff location"] as const) {
    const clear = page.getByRole("button", {
      name: `Clear ${field.toLowerCase()}`,
    });
    if (await clear.isVisible()) await clear.click();
    await expect(
      page.getByRole("textbox", { name: field, exact: true }),
    ).toHaveValue("");
  }
}

/** Type to filter a location SearchableSelect, then click the matching option. */
export async function selectLocation(
  page: Page,
  field: LocationField,
  name: string,
) {
  const input = page.getByRole("textbox", { name: field, exact: true });
  await input.fill(name);
  await page.getByRole("option", { name, exact: true }).click();
  await expect(input).toHaveValue(name);
}

/**
 * The calendar opens on the default ride date's month, which may already be
 * next month, so only advance when the target month isn't shown.
 */
export async function showCalendarMonth(page: Page, date: Date) {
  const month = date.toLocaleString("en-US", { month: "long" });
  if (!(await page.getByText(month, { exact: true }).isVisible())) {
    await page.getByRole("button", { name: "Next month" }).click();
  }
  await expect(page.getByText(month, { exact: true })).toBeVisible();
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
): Promise<StudentRouteResponse> {
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
  return (await res.json()) as StudentRouteResponse;
}

export async function scheduleRide(
  admin: APIRequestContext,
  routeId: string,
): Promise<AdminRouteResponse> {
  const res = await admin.post("/api/routes/schedule", {
    data: {
      routeId,
      driverId: PERSONAS.driver.id,
      vehicleId: VEHICLE.id,
    },
  });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()) as AdminRouteResponse;
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
  expect((JSON.parse(body) as { status: string }).status).toBe(expected);
}
