/**
 * Seed script for local development.
 *
 * Run via:  npx tsx scripts/seed.ts [postgresql-url]
 *       or:  npm run seed [-- postgresql-url]
 *
 * Idempotent — checks for existing data before inserting.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type Location,
  type Vehicle,
  type Prisma,
  type Route,
} from "@db/generated/client";
import type { LocationInput } from "@/utils/types";
import type { VehicleInput } from "@/utils/types/vehicle";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

const DATABASE_URL =
  process.argv[2] ??
  process.env.DATABASE_URL ??
  "postgresql://able:able@localhost:5432/able_alliance";
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: DATABASE_URL }),
});

// Existing local fixtures are kept when reseeding.
async function seedRecord<T>(
  existing: Promise<T | null>,
  create: () => Promise<T>,
  label: string,
): Promise<T> {
  const row = await existing;
  console.log(`${row ? "– Existing" : "✓ Creating"} ${label}`);
  return row ?? create();
}
function seedUser(
  query: { username: string },
  data: Prisma.UserCreateInput,
  label: string,
) {
  return seedRecord(
    db.user.findUnique({ where: query }),
    () =>
      db.user.create({
        data: { ...data, settings: data.settings ?? { create: {} } },
      }),
    label,
  );
}
function seedLocation(
  query: { name: string },
  data: LocationInput,
  label: string,
) {
  return seedRecord(
    db.location.findUnique({ where: query }),
    () => db.location.create({ data }),
    label,
  );
}
function seedVehicle(
  query: { vehicleId: string },
  data: VehicleInput,
  label: string,
) {
  return seedRecord(
    db.vehicle.findUnique({ where: query }),
    () => db.vehicle.create({ data }),
    label,
  );
}
function seedAccommodation(
  query: { label: string },
  data: { label: string },
  label: string,
) {
  return seedRecord(
    db.accommodation.findUnique({ where: query }),
    () => db.accommodation.create({ data }),
    label,
  );
}

async function seed() {
  console.log("Connecting to PostgreSQL…");
  await db.$connect();

  // ---------- Accommodations ----------
  for (const label of [
    "Wheelchair",
    "LowMobility",
    "VisualImpairment",
    "ExtraTime",
  ]) {
    await seedAccommodation({ label }, { label }, `accommodation: ${label}`);
  }

  // ---------- Users ----------

  const student1 = await seedUser(
    { username: "gburdell3" },
    {
      firstName: "George",
      lastName: "Burdell",
      preferredName: "G",
      username: "gburdell3",
      email: "gburdell3@gatech.edu",
      type: "Student",
      studentInfo: {
        create: {
          accessibilityNeeds: {
            connect: ["Wheelchair", "ExtraTime"].map((label) => ({ label })),
          },
        },
      },
    },
    "student: George Burdell",
  );

  const student2 = await seedUser(
    { username: "jdoe3" },
    {
      firstName: "Jane",
      lastName: "Doe",
      username: "jdoe3",
      email: "jdoe3@gatech.edu",
      type: "Student",
      studentInfo: { create: { notes: "Please call ahead of arrival." } },
    },
    "student: Jane Doe",
  );

  const student3 = await seedUser(
    { username: "mchen3" },
    {
      firstName: "Michael",
      lastName: "Chen",
      username: "mchen3",
      email: "mchen3@gatech.edu",
      type: "Student",
      studentInfo: {
        create: {
          accessibilityNeeds: {
            connect: [{ label: "LowMobility" }],
          },
        },
      },
    },
    "student: Michael Chen",
  );

  const student4 = await seedUser(
    { username: "spriya3" },
    {
      firstName: "Sara",
      lastName: "Priya",
      username: "spriya3",
      email: "spriya3@gatech.edu",
      type: "Student",
      studentInfo: {
        create: {
          accessibilityNeeds: {
            connect: [{ label: "VisualImpairment" }],
          },
          notes: "Needs extra assistance at entry.",
        },
      },
    },
    "student: Sara Priya",
  );

  const driver1 = await seedUser(
    { username: "driver1" },
    {
      firstName: "Test",
      lastName: "Driver",
      preferredName: "TD",
      username: "driver1",
      email: "driver1@gatech.edu",
      type: "Driver",
      shifts: {
        create: [
          { dayOfWeek: 1, startTime: "08:00", endTime: "14:00" },
          { dayOfWeek: 2, startTime: "08:00", endTime: "14:00" },
          { dayOfWeek: 3, startTime: "08:00", endTime: "14:00" },
          { dayOfWeek: 4, startTime: "08:00", endTime: "14:00" },
          { dayOfWeek: 5, startTime: "08:00", endTime: "14:00" },
        ],
      },
    },
    "driver: Test Driver",
  );

  const driver2 = await seedUser(
    { username: "driver2" },
    {
      firstName: "Alex",
      lastName: "Smith",
      username: "driver2",
      email: "driver2@gatech.edu",
      type: "Driver",
      shifts: {
        create: [
          { dayOfWeek: 1, startTime: "13:00", endTime: "19:00" },
          { dayOfWeek: 3, startTime: "13:00", endTime: "19:00" },
          { dayOfWeek: 5, startTime: "13:00", endTime: "19:00" },
          { dayOfWeek: 6, startTime: "10:00", endTime: "16:00" },
        ],
      },
    },
    "driver: Alex Smith",
  );

  const driver3 = await seedUser(
    { username: "aevans3" },
    {
      firstName: "Austin",
      lastName: "Evans",
      username: "aevans3",
      email: "aevans3@gatech.edu",
      type: "Driver",
      shifts: {
        create: [
          { dayOfWeek: 0, startTime: "09:00", endTime: "15:00" },
          { dayOfWeek: 2, startTime: "09:00", endTime: "15:00" },
          { dayOfWeek: 4, startTime: "09:00", endTime: "15:00" },
        ],
      },
    },
    "driver: Austin Evans",
  );

  const adminUser = await seedUser(
    { username: "adminuser" },
    {
      firstName: "Admin",
      lastName: "User",
      username: "adminuser",
      email: "adminuser@gatech.edu",
      type: "Admin",
    },
    "admin: Admin User",
  );

  await seedUser(
    { username: "dnestani3" },
    {
      firstName: "Daniele",
      lastName: "Nestani",
      username: "dnestani3",
      email: "dnestani3@gatech.edu",
      type: "Admin",
    },
    "admin: Daniele Nestani",
  );

  await seedUser(
    { username: "superadmin" },
    {
      firstName: "Super",
      lastName: "Admin",
      username: "superadmin",
      email: "superadmin@gatech.edu",
      type: "SuperAdmin",
    },
    "superadmin: Super Admin",
  );

  // ---------- Locations ----------

  const locDefs = [
    {
      name: "Exhibition Hall",
      latitude: 33.7756,
      longitude: -84.4027,
    },
    {
      name: "Tech Square Eastbound",
      latitude: 33.7767,
      longitude: -84.3891,
    },
    {
      name: "Student Center",
      latitude: 33.7739,
      longitude: -84.3983,
    },
    {
      name: "Campus Recreation Center",
      latitude: 33.7748,
      longitude: -84.4015,
    },
    {
      name: "Clough Undergraduate Learning Commons",
      latitude: 33.7745,
      longitude: -84.3963,
    },
    {
      name: "West Village Dining",
      latitude: 33.7771,
      longitude: -84.4051,
    },
    {
      name: "Eighth Street Apartments",
      latitude: 33.7732,
      longitude: -84.3942,
    },
    {
      name: "North Avenue Apartments",
      latitude: 33.7718,
      longitude: -84.3923,
    },
    {
      name: "Stamps Health Services",
      latitude: 33.7758,
      longitude: -84.4001,
    },
    {
      name: "Ferst Center for the Arts",
      latitude: 33.7793,
      longitude: -84.4017,
    },
  ];

  const locations: Record<string, Location> = {};
  for (const def of locDefs) {
    const loc = await seedLocation(
      { name: def.name },
      def,
      `location: ${def.name}`,
    );
    locations[def.name] = loc;
  }

  // ---------- Vehicles ----------

  const vehicleDefs: VehicleInput[] = [
    {
      vehicleId: "1001",
      name: "2026 Honda HR-V",
      licensePlate: "RVG1730",
      description: "White SUV",
      accessibility: "Wheelchair",
      seatCount: 4,
    },
    {
      vehicleId: "1002",
      name: "2024 Toyota Sienna",
      licensePlate: "GTX2241",
      description: "Silver minivan, wheelchair lift",
      accessibility: "Wheelchair",
      seatCount: 6,
    },
    {
      vehicleId: "1003",
      name: "2025 Ford Transit",
      licensePlate: "BZQ9914",
      description: "Blue transit van",
      accessibility: "None",
      seatCount: 8,
    },
    {
      vehicleId: "1004",
      name: "2023 Chrysler Pacifica",
      licensePlate: "APL5583",
      description: "Red minivan",
      accessibility: "Wheelchair",
      seatCount: 5,
    },
    {
      vehicleId: "1005",
      name: "2025 Honda Odyssey",
      licensePlate: "KMT3302",
      description: "Black minivan",
      accessibility: "None",
      seatCount: 7,
    },
  ];

  const vehicles: Record<string, Vehicle> = {};
  for (const def of vehicleDefs) {
    const v = await seedVehicle(
      { vehicleId: def.vehicleId },
      def,
      `vehicle: ${def.name} (ID ${def.vehicleId})`,
    );
    vehicles[def.vehicleId] = v;
  }

  // ---------- Routes ----------
  // Explicit fixture durations keep the sample schedule repeatable offline.
  const tripMinutes = 20;
  const windowMinutes = 30;
  const slotSpacingMinutes = 90;
  const now = new Date();
  const today = formatInTimeZone(now, "America/New_York", "yyyy-MM-dd");
  const students = [student1, student2, student3, student4];
  const fleet = Object.values(vehicles);
  const drivers = await db.user.findMany({
    where: { id: { in: [driver1.id, driver2.id, driver3.id] }, type: "Driver" },
    include: {
      shifts: {
        orderBy: [
          { dayOfWeek: "asc" },
          { startTime: "asc" },
          { endTime: "asc" },
        ],
      },
    },
    orderBy: { username: "asc" },
  });
  const stops = Object.values(locations);
  const planned: Omit<Route, "id">[] = [];
  let studentCursor = 0;

  function conflicts(a: Omit<Route, "id">, b: Omit<Route, "id">) {
    const sharedResource =
      a.studentId === b.studentId ||
      (a.driverId !== null && a.driverId === b.driverId) ||
      (a.vehicleId !== null && a.vehicleId === b.vehicleId);
    const endA = Math.max(
      a.pickupWindowEnd.getTime(),
      a.estimatedDropoffTime?.getTime() ?? 0,
    );
    const endB = Math.max(
      b.pickupWindowEnd.getTime(),
      b.estimatedDropoffTime?.getTime() ?? 0,
    );
    return (
      sharedResource &&
      a.pickupWindowStart.getTime() < endB &&
      b.pickupWindowStart.getTime() < endA
    );
  }

  // Use a UTC calendar date to advance days independently of the host timezone.
  // Convert each driver's local shift times to UTC in America/New_York.
  for (let dayOffset = -2; dayOffset < 14; dayOffset++) {
    const day = new Date(`${today}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + dayOffset);
    const date = day.toISOString().slice(0, 10);
    for (const [driverIndex, driver] of drivers.entries()) {
      const vehicle = fleet[(dayOffset + 2 + driverIndex) % fleet.length];
      for (const shift of driver.shifts.filter(
        (shift) => shift.dayOfWeek === day.getUTCDay(),
      )) {
        const shiftStart = fromZonedTime(
          `${date}T${shift.startTime}:00`,
          "America/New_York",
        );
        const shiftEnd = fromZonedTime(
          `${date}T${shift.endTime}:00`,
          "America/New_York",
        );
        // Two assigned rides and one future request per shift, with room to turn around.
        for (let slot = 0; slot < 3; slot++) {
          const pickup = new Date(
            shiftStart.getTime() +
              (windowMinutes + slot * slotSpacingMinutes) * 60000,
          );
          const windowStart = new Date(
            pickup.getTime() - windowMinutes * 60000,
          );
          const windowEnd = new Date(pickup.getTime() + windowMinutes * 60000);
          const dropoff = new Date(pickup.getTime() + tripMinutes * 60000);
          if (windowEnd > shiftEnd || dropoff > shiftEnd) continue;
          const requested = slot === 2;
          if (requested && pickup <= now) continue;
          const pickupLocation =
            stops[(dayOffset + 2 + driverIndex + slot) % stops.length];
          const dropoffLocation =
            stops[(dayOffset + 3 + driverIndex + slot) % stops.length];
          for (let attempt = 0; attempt < students.length; attempt++) {
            const studentIndex = (studentCursor + attempt) % students.length;
            const candidate: Omit<Route, "id"> = {
              studentId: students[studentIndex].id,
              driverId: requested ? null : driver.id,
              vehicleId: requested ? null : vehicle.id,
              pickupLocation: pickupLocation.id,
              dropoffLocation: dropoffLocation.id,
              scheduledPickupTime: pickup,
              pickupWindowStart: windowStart,
              pickupWindowEnd: windowEnd,
              estimatedDropoffTime: dropoff,
              status: requested
                ? "Requested"
                : dropoff <= now
                  ? "Completed"
                  : pickup <= now
                    ? "Pickedup"
                    : "Scheduled",
            };
            if (planned.some((other) => conflicts(candidate, other))) continue;
            planned.push(candidate);
            studentCursor = (studentIndex + 1) % students.length;
            break;
          }
        }
      }
    }
  }

  const existingRoutes = await db.route.findMany({
    where: {
      OR: [
        { studentId: { in: students.map((student) => student.id) } },
        { driverId: { in: drivers.map((driver) => driver.id) } },
        { vehicleId: { in: fleet.map((vehicle) => vehicle.id) } },
      ],
    },
  });
  let created = 0;
  let skippedExisting = 0;
  let skippedConflicts = 0;
  for (const candidate of planned) {
    if (
      existingRoutes.some(
        (route) =>
          route.studentId === candidate.studentId &&
          route.scheduledPickupTime.getTime() ===
            candidate.scheduledPickupTime.getTime(),
      )
    ) {
      skippedExisting++;
      continue;
    }
    if (existingRoutes.some((route) => conflicts(candidate, route))) {
      skippedConflicts++;
      continue;
    }
    const createdRoute = await db.route.create({ data: candidate });
    existingRoutes.push(createdRoute);
    created++;
  }
  console.log(
    `\n– Routes: created ${created}, existing ${skippedExisting}, conflicting slots skipped ${skippedConflicts}`,
  );

  // ---------- Chat messages ----------
  // Add a small conversation to a seeded ride so the admin chat view has
  // real relational messages to display. Select today's active ride when
  // possible so the websocket chat can also be exercised locally.
  const chatRoutes = await db.route.findMany({
    where: { studentId: { in: students.map((student) => student.id) } },
    orderBy: { scheduledPickupTime: "asc" },
  });
  const todayActiveRoute = chatRoutes.find(
    (route) =>
      formatInTimeZone(
        route.scheduledPickupTime,
        "America/New_York",
        "yyyy-MM-dd",
      ) === today &&
      ["Scheduled", "EnRoute", "Pickedup"].includes(route.status),
  );
  const chatRoute =
    todayActiveRoute ??
    chatRoutes.find((route) =>
      ["Scheduled", "EnRoute", "Pickedup"].includes(route.status),
    );

  if (chatRoute) {
    const examples = [
      {
        senderId: chatRoute.studentId,
        text: "Hi, I’m ready for my ride. I’ll be at the pickup location.",
      },
      {
        senderId: adminUser.id,
        text: "Thanks for letting us know. Your ride is scheduled.",
      },
      ...(chatRoute.driverId
        ? [
            {
              senderId: chatRoute.driverId,
              text: "I’m on my way to the pickup location.",
            },
          ]
        : []),
    ];

    for (const [index, example] of examples.entries()) {
      const exists = await db.message.findFirst({
        where: {
          routeId: chatRoute.id,
          senderId: example.senderId,
          text: example.text,
        },
      });
      if (exists) continue;

      await db.message.create({
        data: {
          routeId: chatRoute.id,
          senderId: example.senderId,
          text: example.text,
          time: new Date(Date.now() - (examples.length - index) * 60_000),
        },
      });
    }
    console.log(`✓ Seeded chat messages for route ${chatRoute.id}`);
  } else {
    console.log("– No active seeded route available for chat messages");
  }

  console.log("\nSeed complete!");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
