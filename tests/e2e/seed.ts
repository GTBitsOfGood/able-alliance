/**
 * Who and what exists when a run starts. Also Playwright's globalSetup.
 *
 * Fixed ObjectIds so specs reference users/locations/vehicles without lookups.
 * No routes are seeded: each flow creates its own ride, so flows never
 * collide even when the api and ui projects run in parallel.
 */
import mongoose, { Types } from "mongoose";
import { E2E } from "./env";

export type UserType = "Student" | "Driver" | "Admin";

export interface Persona {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  type: UserType;
}

/** 24-char hex ObjectId with a readable suffix, e.g. oid("a001"). */
const oid = (suffix: string) => "e2e" + "0".repeat(21 - suffix.length) + suffix;

export const PERSONAS = {
  student: {
    id: oid("a001"),
    email: "gburdell3@gatech.edu",
    firstName: "George",
    lastName: "Burdell",
    type: "Student",
  },
  driver: {
    id: oid("a002"),
    email: "driver1@gatech.edu",
    firstName: "Test",
    lastName: "Driver",
    type: "Driver",
  },
  admin: {
    id: oid("a003"),
    email: "admin@gatech.edu",
    firstName: "Admin",
    lastName: "User",
    type: "Admin",
  },
} as const satisfies Record<string, Persona>;

export type PersonaKey = keyof typeof PERSONAS;

export const LOCATIONS = {
  exhibitionHall: {
    id: oid("b001"),
    name: "Exhibition Hall",
    latitude: 33.7756,
    longitude: -84.4027,
  },
  techSquare: {
    id: oid("b002"),
    name: "Tech Square Eastbound",
    latitude: 33.7767,
    longitude: -84.3891,
  },
  studentCenter: {
    id: oid("b003"),
    name: "Student Center",
    latitude: 33.7739,
    longitude: -84.3983,
  },
} as const;

export const VEHICLE = {
  id: oid("c001"),
  vehicleId: "1001",
  name: "2026 Honda HR-V",
  licensePlate: "RVG1730",
  description: "White SUV",
  accessibility: "Wheelchair",
  seatCount: 4,
} as const;

const toObjectId = (hex: string) => Types.ObjectId.createFromHexString(hex);

function buildSeed() {
  const user = (p: Persona) => ({
    _id: toObjectId(p.id),
    firstName: p.firstName,
    lastName: p.lastName,
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
      { ...user(PERSONAS.student), studentInfo: {} },
      { ...user(PERSONAS.driver), shifts: allWeek },
      user(PERSONAS.admin),
    ],
    locations: Object.values(LOCATIONS).map((l) => ({
      _id: toObjectId(l.id),
      name: l.name,
      latitude: l.latitude,
      longitude: l.longitude,
    })),
    vehicles: [
      {
        _id: toObjectId(VEHICLE.id),
        vehicleId: VEHICLE.vehicleId,
        name: VEHICLE.name,
        licensePlate: VEHICLE.licensePlate,
        description: VEHICLE.description,
        accessibility: VEHICLE.accessibility,
        seatCount: VEHICLE.seatCount,
      },
    ],
    accommodations: ["Wheelchair", "LowMobility"].map((label) => ({ label })),
  };
}

const COLLECTIONS = [
  "users",
  "locations",
  "vehicles",
  "accommodations",
  "routes",
  "chatlogs",
];

export async function resetAndSeed(uri: string = E2E.mongodbUri) {
  const conn = await mongoose
    .createConnection(uri, { serverSelectionTimeoutMS: 5000 })
    .asPromise();
  try {
    if (process.env.E2E_ALLOW_ANY_DB !== "1" && !/e2e|test/i.test(conn.name)) {
      throw new Error(
        `[e2e] Refusing to wipe database "${conn.name}". Use a name containing "e2e"/"test" or set E2E_ALLOW_ANY_DB=1.`,
      );
    }
    const db = conn.db!;
    for (const name of COLLECTIONS) await db.collection(name).deleteMany({});
    const data = buildSeed();
    for (const [name, docs] of Object.entries(data)) {
      await db.collection(name).insertMany(docs as mongoose.mongo.Document[]);
    }
    console.log(
      `[e2e] Seeded "${conn.name}": ` +
        Object.entries(data)
          .map(([k, v]) => `${k}=${v.length}`)
          .join(", "),
    );
  } finally {
    await conn.close();
  }
}

export default async function globalSetup() {
  await resetAndSeed();
}
