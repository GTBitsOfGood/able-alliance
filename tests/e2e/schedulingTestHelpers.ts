import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { toZonedTime } from "date-fns-tz";
import { expect, mintSessionToken } from "./fixtures";
import { E2E } from "./env";
import { LOCATIONS } from "./seed";

import { modalDropdown } from "./routeTestHelpers";

export { futureSlot, modalDropdown } from "./routeTestHelpers";

const TZ = "America/New_York";
const MINUTE = 60_000;

export type TestUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  types: ("Student" | "Driver" | "Admin" | "SuperAdmin")[];
};

export type TestVehicle = {
  id: string;
  name: string;
  licensePlate: string;
};

export function uniqueTag(prefix: string): string {
  return `${prefix}${randomUUID().replaceAll("-", "").slice(0, 10)}`;
}

export async function createStudent(
  admin: APIRequestContext,
  label: string,
  accessibilityNeeds: string[] = [],
): Promise<TestUser> {
  const tag = uniqueTag(label);
  const response = await admin.post("/api/users", {
    data: {
      firstName: "Scheduling",
      lastName: tag,
      username: tag,
      email: `${tag}@example.edu`,
      types: ["Student"],
      studentInfo: { accessibilityNeeds },
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as TestUser;
}

export async function createDriver(
  admin: APIRequestContext,
  label: string,
  date: Date,
  startTime = "07:30",
  endTime = "19:45",
): Promise<TestUser> {
  const tag = uniqueTag(label);
  const created = await admin.post("/api/users", {
    data: {
      firstName: "Scheduling",
      lastName: tag,
      username: tag,
      email: `${tag}@example.edu`,
      types: ["Driver"],
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const driver = (await created.json()) as TestUser;
  const shifted = await admin.patch(`/api/users/${driver.id}`, {
    data: {
      shifts: [
        {
          dayOfWeek: toZonedTime(date, TZ).getDay(),
          startTime,
          endTime,
        },
      ],
    },
  });
  expect(shifted.status(), await shifted.text()).toBe(200);
  return driver;
}

export async function createVehicle(
  admin: APIRequestContext,
  label: string,
  accessibility: "None" | "Wheelchair" = "None",
): Promise<TestVehicle> {
  const tag = uniqueTag(label);
  const response = await admin.post("/api/vehicles", {
    data: {
      vehicleId: tag,
      name: `Test vehicle ${tag}`,
      licensePlate: tag.toUpperCase().slice(-12),
      accessibility,
      seatCount: 4,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as TestVehicle;
}

export async function studentApi(
  playwright: typeof import("playwright-core"),
  student: TestUser,
): Promise<APIRequestContext> {
  return playwright.request.newContext({
    baseURL: E2E.baseURL,
    storageState: {
      cookies: [
        {
          name: E2E.sessionCookieName,
          value: await mintSessionToken(student),
          domain: new URL(E2E.baseURL).hostname,
          path: "/",
          httpOnly: true,
          secure: E2E.baseURL.startsWith("https:"),
          sameSite: "Lax",
          expires: -1,
        },
      ],
      origins: [],
    },
  });
}

export async function createRide(
  student: APIRequestContext,
  pickup: Date,
  locations: {
    pickup?: string;
    dropoff?: string;
  } = {},
): Promise<string> {
  const response = await student.post("/api/routes", {
    data: {
      pickupLocation: locations.pickup ?? LOCATIONS.exhibitionHall.id,
      dropoffLocation: locations.dropoff ?? LOCATIONS.studentCenter.id,
      scheduledPickupTime: pickup.toISOString(),
      pickupWindowStart: new Date(pickup.getTime() - 15 * MINUTE).toISOString(),
      pickupWindowEnd: new Date(pickup.getTime() + 15 * MINUTE).toISOString(),
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return String(((await response.json()) as { id: string }).id);
}

export async function schedule(
  admin: APIRequestContext,
  routeId: string,
  driverId: string,
  vehicleId: string,
) {
  return admin.post("/api/routes/schedule", {
    data: { routeId, driverId, vehicleId },
  });
}

export async function openScheduleModal(
  page: Page,
  routeId: string,
): Promise<{ dialog: Locator; row: Locator }> {
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
  return { dialog, row };
}

export async function selectModalAssignment(
  page: Page,
  dialog: Locator,
  driver: TestUser,
  vehicle: TestVehicle,
): Promise<void> {
  await (await modalDropdown(dialog, "Choose a driver")).click();
  await page
    .getByRole("menuitem", {
      name: `${driver.lastName}, ${driver.firstName}`,
      exact: true,
    })
    .click();
  await (await modalDropdown(dialog, "Choose a vehicle")).click();
  await page
    .getByRole("menuitem", {
      name: `${vehicle.name} (${vehicle.licensePlate})`,
      exact: true,
    })
    .click();
}

export async function routeState(
  admin: APIRequestContext,
  routeId: string,
): Promise<{
  status: string;
  driver: { id: string } | null;
  vehicle: { id: string } | null;
}> {
  const response = await admin.get(`/api/routes/${routeId}`);
  expect(response.status(), await response.text()).toBe(200);
  return response.json();
}

export async function routeUpdateAuditCount(
  admin: APIRequestContext,
  routeIds: string[],
): Promise<number> {
  const response = await admin.get(
    "/api/audit-entries?entityType=Route&action=Update&pageSize=100",
  );
  expect(response.status(), await response.text()).toBe(200);
  const body = (await response.json()) as {
    entries: { entityId: string }[];
  };
  const wanted = new Set(routeIds);
  return body.entries.filter((entry) => wanted.has(entry.entityId)).length;
}
