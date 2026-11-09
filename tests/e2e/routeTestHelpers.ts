import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { addDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { expect } from "./fixtures";
import { PERSONAS, VEHICLE } from "./seed";

const TZ = "America/New_York";
const MINUTE = 60 * 1000;

import type { AdminRouteResponse, StudentRouteResponse } from "@/types/api";

export function estDateDaysFromNow(days: number): Date {
  return addDays(toZonedTime(new Date(), TZ), days);
}

/** New York calendar date of the Nth weekday after today, as local fields. */
function serviceDateWeekdaysAhead(weekdaysAhead: number): Date {
  let date = estDateDaysFromNow(0);
  for (let remaining = weekdaysAhead; remaining > 0;) {
    date = addDays(date, 1);
    if (date.getDay() !== 0 && date.getDay() !== 6) remaining--;
  }
  return date;
}

export function nextServiceDate(): Date {
  return serviceDateWeekdaysAhead(1);
}

/**
 * The instant of New York wall-clock `time` ("HH:mm") on the Nth weekday
 * after today. Rides must fall Monday–Friday within service hours, so fixtures
 * use this instead of `Date.now() + hours`, which depends on when the suite
 * runs. Distinct `weekdaysAhead` values always land on distinct dates.
 */
export function futureSlot(weekdaysAhead: number, time: string): Date {
  const day = format(serviceDateWeekdaysAhead(weekdaysAhead), "yyyy-MM-dd");
  return fromZonedTime(`${day}T${time}:00`, TZ);
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
 * The trigger of a labelled BogDropdown inside the assignment modal. Its
 * accessible name is only its placeholder, which reads "Checking
 * availability..." until the driver list loads, so match on the label and
 * wait for a selectable state instead of grabbing the first "Select..." button.
 */
export async function modalDropdown(
  dialog: Locator,
  label: "Choose a driver" | "Choose a vehicle",
): Promise<Locator> {
  const trigger = dialog
    .locator("label", { hasText: label })
    .locator("xpath=..")
    .locator(":scope > button");
  await expect(trigger).toBeEnabled();
  await expect(trigger).not.toHaveText(/Checking availability/);
  return trigger;
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
  await (await modalDropdown(dialog, "Choose a driver")).click();
  await page
    .getByRole("menuitem", {
      name: `${PERSONAS.driver.lastName}, ${PERSONAS.driver.firstName}`,
      exact: true,
    })
    .click();
  await (await modalDropdown(dialog, "Choose a vehicle")).click();
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
    pickup,
  }: {
    pickupLocation: string;
    dropoffLocation: string;
    /** Use `futureSlot` so parallel flows on the shared personas never overlap. */
    pickup: Date;
  },
): Promise<StudentRouteResponse> {
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
