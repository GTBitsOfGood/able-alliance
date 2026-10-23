/**
 * Who and what exists when a run starts. Also Playwright's globalSetup.
 *
 * Fixed UUIDs so specs reference users/locations/vehicles without lookups.
 * No routes are seeded: each flow creates its own ride, so flows never
 * collide even when the api and ui projects run in parallel.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@db/generated/client";
import { E2E } from "./env";

import type { User } from "@db/generated/browser";

export type Persona = Pick<
  User,
  "id" | "username" | "email" | "firstName" | "lastName"
> & {
  type: Extract<User["type"], "Student" | "Driver" | "Admin">;
};

/** Stable UUIDs let specs reference fixtures without lookups. */
const fixtureId = (suffix: string) =>
  `e2e00000-0000-4000-8000-${suffix.padStart(12, "0")}`;

export const PERSONAS = {
  student: {
    id: fixtureId("a001"),
    username: "gburdell3",
    email: "gburdell3@gatech.edu",
    firstName: "George",
    lastName: "Burdell",
    type: "Student",
  },
  driver: {
    id: fixtureId("a002"),
    username: "driver1",
    email: "driver1@gatech.edu",
    firstName: "Test",
    lastName: "Driver",
    type: "Driver",
  },
  admin: {
    id: fixtureId("a003"),
    username: "adminuser",
    email: "adminuser@gatech.edu",
    firstName: "Admin",
    lastName: "User",
    type: "Admin",
  },
} as const satisfies Record<string, Persona>;

export type PersonaKey = keyof typeof PERSONAS;

export const LOCATIONS = {
  exhibitionHall: {
    id: fixtureId("b001"),
    name: "Exhibition Hall",
    latitude: 33.7756,
    longitude: -84.4027,
  },
  techSquare: {
    id: fixtureId("b002"),
    name: "Tech Square Eastbound",
    latitude: 33.7767,
    longitude: -84.3891,
  },
  studentCenter: {
    id: fixtureId("b003"),
    name: "Student Center",
    latitude: 33.7739,
    longitude: -84.3983,
  },
} as const;

export const VEHICLE = {
  id: fixtureId("c001"),
  vehicleId: "1001",
  name: "2026 Honda HR-V",
  licensePlate: "RVG1730",
  description: "White SUV",
  accessibility: "Wheelchair",
  seatCount: 4,
} as const;

function buildSeed() {
  const user = (p: Persona) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    username: p.username,
    email: p.email,
    type: p.type,
  });
  // On shift every day, all day, so the flow never trips the availability check.
  const allWeek = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    startTime: "00:00",
    endTime: "23:59",
  }));
  return {
    users: [
      { ...user(PERSONAS.student), studentInfo: { create: {} } },
      { ...user(PERSONAS.driver), shifts: { create: allWeek } },
      user(PERSONAS.admin),
    ],
    locations: Object.values(LOCATIONS).map((l) => ({
      id: l.id,
      name: l.name,
      latitude: l.latitude,
      longitude: l.longitude,
    })),
    vehicles: [
      {
        id: VEHICLE.id,
        vehicleId: VEHICLE.vehicleId,
        name: VEHICLE.name,
        licensePlate: VEHICLE.licensePlate,
        description: VEHICLE.description,
        accessibility: VEHICLE.accessibility,
        seatCount: VEHICLE.seatCount,
      },
    ],
    accommodations: ["Wheelchair", "LowMobility"].map((label) => ({
      label,
    })),
  };
}

export async function resetAndSeed(url: string = E2E.databaseUrl) {
  const target = new URL(url);
  const name = decodeURIComponent(target.pathname.slice(1));
  if (process.env.E2E_ALLOW_ANY_DB !== "1" && !/e2e|test/i.test(name)) {
    throw new Error(
      `[e2e] Refusing to wipe database "${name}". Use a name containing "e2e"/"test" or set E2E_ALLOW_ANY_DB=1.`,
    );
  }
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  try {
    const data = buildSeed();
    await db.$transaction(async (tx) => {
      await tx.message.deleteMany();
      await tx.route.deleteMany();
      await tx.user.deleteMany();
      await tx.location.deleteMany();
      await tx.vehicle.deleteMany();
      await tx.accommodation.deleteMany();
      await tx.location.createMany({ data: data.locations });
      await tx.vehicle.createMany({ data: data.vehicles });
      await tx.accommodation.createMany({ data: data.accommodations });
      for (const user of data.users)
        await tx.user.create({ data: { ...user, settings: { create: {} } } });
    });
    console.log(
      `[e2e] Seeded "${name}": ` +
        Object.entries(data)
          .map(([k, v]) => `${k}=${v.length}`)
          .join(", "),
    );
  } finally {
    await db.$disconnect();
  }
}

export default async function globalSetup() {
  await resetAndSeed();
}
