import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { addDays, isWeekend, set } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { expect } from "./fixtures";
import { PERSONAS, VEHICLE } from "./seed";

const MINUTE = 60 * 1000;
const TZ = "America/New_York";

import type { AdminRouteResponse, StudentRouteResponse } from "@/types/api";

export function estDateDaysFromNow(days: number): Date {
  return addDays(toZonedTime(new Date(), TZ), days);
}

/** The Nth upcoming weekday (1 = next weekday) as a New York wall-clock date. */
export function serviceDateAhead(serviceDays: number): Date {
  let date = estDateDaysFromNow(0);
  for (let remaining = serviceDays; remaining > 0;) {
    date = addDays(date, 1);
    if (!isWeekend(date)) remaining--;
  }
  return date;
}

export function nextServiceDate(): Date {
  return serviceDateAhead(1);
}

// Pickup time is unique, and a retried test must not collide with its own earlier attempt
export function servicePickupTime(
  serviceDaysAhead: number,
  time: string,
): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const wallClock = set(serviceDateAhead(serviceDaysAhead), {
    hours,
    minutes,
    seconds: 0,
    milliseconds: 0,
  });
  return new Date(
    fromZonedTime(wallClock, TZ).getTime() + (Date.now() % MINUTE),
  );
}

export function pickupWindow(pickup: Date) {
  return {
    scheduledPickupTime: pickup.toISOString(),
    pickupWindowStart: new Date(pickup.getTime() - 30 * MINUTE).toISOString(),
    pickupWindowEnd: new Date(pickup.getTime() + 30 * MINUTE).toISOString(),
  };
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

function dropdownTrigger(dialog: Locator, label: string) {
  return dialog
    .getByText(label)
    .locator("xpath=ancestor::div[1]")
    .getByRole("button", { name: "Select...", exact: true });
}

/** Schedule through the current admin row menu and Schedule ride modal. */
export async function scheduleRideInAdmin(page: Page, routeId: string) {
  const row = page.locator(`tr[data-route-id="${routeId}"]`);
  await expect(row).toHaveCount(1);
  await row.hover();
  await row.getByRole("button", { name: /^Actions for / }).click();
  await page
    .getByRole("menuitem", { name: "Schedule ride", exact: true })
    .click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Schedule ride", exact: true }),
  ).toBeVisible();
  await dropdownTrigger(dialog, "Choose a driver").click();
  await page
    .getByRole("menuitem", {
      name: `${PERSONAS.driver.lastName}, ${PERSONAS.driver.firstName}`,
      exact: true,
    })
    .click();
  await dropdownTrigger(dialog, "Choose a vehicle").click();
  await page
    .getByRole("menuitem", {
      name: `${VEHICLE.name} (${VEHICLE.licensePlate})`,
      exact: true,
    })
    .click();

  const scheduled = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/routes/schedule") &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  const response = await scheduled;
  expect(response.status(), await response.text()).toBe(200);
  await expect(dialog).toBeHidden();
  await expect(row.getByText("Scheduled", { exact: true })).toBeVisible();
  await expect(
    row.getByText(`${PERSONAS.driver.firstName} ${PERSONAS.driver.lastName}`, {
      exact: true,
    }),
  ).toBeVisible();
  await expect(row.getByText(VEHICLE.name, { exact: true })).toBeVisible();
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
    serviceDaysAhead,
    time,
  }: {
    pickupLocation: string;
    dropoffLocation: string;
    /** See servicePickupTime. */
    serviceDaysAhead: number;
    time: string;
  },
): Promise<StudentRouteResponse> {
  const pickup = servicePickupTime(serviceDaysAhead, time);
  const res = await student.post("/api/routes", {
    data: { pickupLocation, dropoffLocation, ...pickupWindow(pickup) },
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
