/**
 * Seed script for local development.
 *
 * Run via:  npx tsx scripts/seed.ts [mongodb-url]
 *       or:  npm run seed [-- mongodb-url]
 *
 * Idempotent — checks for existing data before inserting.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { getMapboxTravelDuration } from "@/server/mapbox";

let MONGODB_URI =
  process.argv[2] ??
  process.env.MONGODB_URI ??
  "mongodb://localhost:27017/able-alliance";

if (
  MONGODB_URI.includes("localhost") &&
  MONGODB_URI.includes("replicaSet=") &&
  !MONGODB_URI.includes("directConnection=")
) {
  MONGODB_URI +=
    (MONGODB_URI.includes("?") ? "&" : "?") + "directConnection=true";
}

async function upsertOne<T extends Record<string, unknown>>(
  col: mongoose.mongo.Collection,
  query: Partial<T>,
  doc: T,
  label: string,
): Promise<T & { _id: mongoose.Types.ObjectId }> {
  const existing = await col.findOne(query);
  if (existing) {
    console.log(`– ${label} already exists`);
    return existing as T & { _id: mongoose.Types.ObjectId };
  }
  const res = await col.insertOne(doc);
  console.log(`✓ Created ${label}`);
  return { ...doc, _id: res.insertedId } as T & {
    _id: mongoose.Types.ObjectId;
  };
}

async function seed() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  // ---------- Accommodations ----------
  const accCol = db.collection("accommodations");
  for (const label of [
    "Wheelchair",
    "LowMobility",
    "VisualImpairment",
    "ExtraTime",
  ]) {
    await upsertOne(accCol, { label }, { label }, `accommodation: ${label}`);
  }

  // ---------- Users ----------
  const usersCol = db.collection("users");

  const student1 = await upsertOne(
    usersCol,
    { email: "gburdell3@gatech.edu" },
    {
      firstName: "George",
      lastName: "Burdell",
      preferredName: "G",
      email: "gburdell3@gatech.edu",
      type: "Student",
      studentInfo: { accessibilityNeeds: ["Wheelchair", "ExtraTime"] },
    },
    "student: George Burdell",
  );

  const student2 = await upsertOne(
    usersCol,
    { email: "jdoe3@gatech.edu" },
    {
      firstName: "Jane",
      lastName: "Doe",
      email: "jdoe3@gatech.edu",
      type: "Student",
      studentInfo: { notes: "Please call ahead of arrival." },
    },
    "student: Jane Doe",
  );

  const student3 = await upsertOne(
    usersCol,
    { email: "mchen3@gatech.edu" },
    {
      firstName: "Michael",
      lastName: "Chen",
      email: "mchen3@gatech.edu",
      type: "Student",
      studentInfo: { accessibilityNeeds: ["LowMobility"] },
    },
    "student: Michael Chen",
  );

  const student4 = await upsertOne(
    usersCol,
    { email: "spriya3@gatech.edu" },
    {
      firstName: "Sara",
      lastName: "Priya",
      email: "spriya3@gatech.edu",
      type: "Student",
      studentInfo: {
        accessibilityNeeds: ["VisualImpairment"],
        notes: "Needs extra assistance at entry.",
      },
    },
    "student: Sara Priya",
  );

  const driver1 = await upsertOne(
    usersCol,
    { email: "driver1@gatech.edu" },
    {
      firstName: "Test",
      lastName: "Driver",
      preferredName: "TD",
      email: "driver1@gatech.edu",
      type: "Driver",
      shifts: [
        { dayOfWeek: 1, startTime: "08:00", endTime: "14:00" },
        { dayOfWeek: 2, startTime: "08:00", endTime: "14:00" },
        { dayOfWeek: 3, startTime: "08:00", endTime: "14:00" },
        { dayOfWeek: 4, startTime: "08:00", endTime: "14:00" },
        { dayOfWeek: 5, startTime: "08:00", endTime: "14:00" },
      ],
    },
    "driver: Test Driver",
  );

  const driver2 = await upsertOne(
    usersCol,
    { email: "driver2@gatech.edu" },
    {
      firstName: "Alex",
      lastName: "Smith",
      email: "driver2@gatech.edu",
      type: "Driver",
      shifts: [
        { dayOfWeek: 1, startTime: "13:00", endTime: "19:00" },
        { dayOfWeek: 3, startTime: "13:00", endTime: "19:00" },
        { dayOfWeek: 5, startTime: "13:00", endTime: "19:00" },
        { dayOfWeek: 6, startTime: "10:00", endTime: "16:00" },
      ],
    },
    "driver: Alex Smith",
  );

  const driver3 = await upsertOne(
    usersCol,
    { email: "aevans3@gatech.edu" },
    {
      firstName: "Austin",
      lastName: "Evans",
      email: "aevans3@gatech.edu",
      type: "Driver",
      shifts: [
        { dayOfWeek: 0, startTime: "09:00", endTime: "15:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "15:00" },
        { dayOfWeek: 4, startTime: "09:00", endTime: "15:00" },
      ],
    },
    "driver: Austin Evans",
  );

  await upsertOne(
    usersCol,
    { email: "admin@gatech.edu" },
    {
      firstName: "Admin",
      lastName: "User",
      email: "admin@gatech.edu",
      type: "Admin",
    },
    "admin: Admin User",
  );

  await upsertOne(
    usersCol,
    { email: "dnestani3@gatech.edu" },
    {
      firstName: "Daniele",
      lastName: "Nestani",
      email: "dnestani3@gatech.edu",
      type: "Admin",
    },
    "admin: Daniele Nestani",
  );

  const superAdmin = await upsertOne(
    usersCol,
    { email: "superadmin@gatech.edu" },
    {
      firstName: "Super",
      lastName: "Admin",
      email: "superadmin@gatech.edu",
      type: "SuperAdmin",
    },
    "superadmin: Super Admin",
  );

  // ---------- Locations ----------
  const locsCol = db.collection("locations");

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

  const locations: Record<
    string,
    { _id: mongoose.Types.ObjectId } & (typeof locDefs)[0]
  > = {};
  for (const def of locDefs) {
    const loc = await upsertOne(
      locsCol,
      { name: def.name },
      def,
      `location: ${def.name}`,
    );
    locations[def.name] = loc as { _id: mongoose.Types.ObjectId } & typeof def;
  }

  // ---------- Vehicles ----------
  const vehCol = db.collection("vehicles");

  const vehicleDefs = [
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

  const vehicles: Record<
    string,
    (typeof vehicleDefs)[0] & { _id: mongoose.Types.ObjectId }
  > = {};
  for (const def of vehicleDefs) {
    const v = await upsertOne(
      vehCol,
      { vehicleId: def.vehicleId },
      def,
      `vehicle: ${def.name} (ID ${def.vehicleId})`,
    );
    vehicles[def.vehicleId] = v as typeof def & {
      _id: mongoose.Types.ObjectId;
    };
  }

  // ---------- Routes ----------
  const routesCol = db.collection("routes");

  const addMinutes = (date: Date, minutes: number): Date =>
    new Date(date.getTime() + minutes * 60 * 1000);

  const makeEmbed = (user: Record<string, unknown>) => ({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    type: user.type,
    ...(user.studentInfo ? { studentInfo: user.studentInfo } : {}),
  });

  const makeVehicleEmbed = (
    v: (typeof vehicleDefs)[0] & { _id: mongoose.Types.ObjectId },
  ) => ({
    _id: v._id,
    vehicleId: v.vehicleId,
    name: v.name,
    licensePlate: v.licensePlate,
    description: v.description,
    accessibility: v.accessibility,
    seatCount: v.seatCount,
  });

  const now = new Date();

  // Build a list of dates: today + 6 more days, plus next 7 days
  const makeDate = (daysOffset: number, hour: number, minute: number): Date => {
    const d = new Date(now);
    d.setDate(now.getDate() + daysOffset);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  type AnyUser = {
    _id: mongoose.Types.ObjectId;
    firstName: string;
    lastName: string;
    email: string;
    type: string;
    preferredName?: string;
    shifts?: { dayOfWeek: number; startTime: string; endTime: string }[];
    studentInfo?: { accessibilityNeeds?: string[]; notes?: string };
  };

  type RouteTemplate = {
    student: AnyUser;
    driver: AnyUser;
    vehicle: (typeof vehicleDefs)[0] & { _id: mongoose.Types.ObjectId };
    pickupLocation: keyof typeof locations;
    dropoffLocation: keyof typeof locations;
    pickupTime: Date;
    status: string;
  };

  const routeTemplates: RouteTemplate[] = [
    // SuperAdmin + driver1 + vehicle 1001 (TESTING)
    {
      student: superAdmin,
      driver: driver1,
      vehicle: vehicles["1001"],
      pickupLocation: "Exhibition Hall",
      dropoffLocation: "Tech Square Eastbound",
      pickupTime: makeDate(0, 10, 0),
      status: "Scheduled",
    },
    // George + driver1 + vehicle 1001
    {
      student: student1,
      driver: driver1,
      vehicle: vehicles["1001"],
      pickupLocation: "Exhibition Hall",
      dropoffLocation: "Tech Square Eastbound",
      pickupTime: makeDate(0, 10, 0),
      status: "Scheduled",
    },
    {
      student: student1,
      driver: driver1,
      vehicle: vehicles["1001"],
      pickupLocation: "Exhibition Hall",
      dropoffLocation: "Tech Square Eastbound",
      pickupTime: makeDate(0, 14, 30),
      status: "Scheduled",
    },
    {
      student: student1,
      driver: driver1,
      vehicle: vehicles["1001"],
      pickupLocation: "Exhibition Hall",
      dropoffLocation: "Student Center",
      pickupTime: makeDate(1, 9, 0),
      status: "Scheduled",
    },
    {
      student: student1,
      driver: driver1,
      vehicle: vehicles["1001"],
      pickupLocation: "Campus Recreation Center",
      dropoffLocation: "Tech Square Eastbound",
      pickupTime: makeDate(2, 11, 0),
      status: "Scheduled",
    },
    {
      student: student1,
      driver: driver2,
      vehicle: vehicles["1002"],
      pickupLocation: "West Village Dining",
      dropoffLocation: "Clough Undergraduate Learning Commons",
      pickupTime: makeDate(3, 13, 30),
      status: "Scheduled",
    },
    {
      student: student1,
      driver: driver2,
      vehicle: vehicles["1002"],
      pickupLocation: "Exhibition Hall",
      dropoffLocation: "Stamps Health Services",
      pickupTime: makeDate(4, 15, 0),
      status: "Scheduled",
    },
    {
      student: student1,
      driver: driver3,
      vehicle: vehicles["1003"],
      pickupLocation: "Eighth Street Apartments",
      dropoffLocation: "Student Center",
      pickupTime: makeDate(-1, 10, 0),
      status: "Completed",
    },
    {
      student: student1,
      driver: driver3,
      vehicle: vehicles["1003"],
      pickupLocation: "North Avenue Apartments",
      dropoffLocation: "Ferst Center for the Arts",
      pickupTime: makeDate(-2, 14, 0),
      status: "Completed",
    },

    // Jane + driver2 + vehicle 1002
    {
      student: student2,
      driver: driver2,
      vehicle: vehicles["1002"],
      pickupLocation: "Student Center",
      dropoffLocation: "Clough Undergraduate Learning Commons",
      pickupTime: makeDate(0, 9, 30),
      status: "Scheduled",
    },
    {
      student: student2,
      driver: driver2,
      vehicle: vehicles["1002"],
      pickupLocation: "Campus Recreation Center",
      dropoffLocation: "West Village Dining",
      pickupTime: makeDate(1, 11, 0),
      status: "Scheduled",
    },
    {
      student: student2,
      driver: driver1,
      vehicle: vehicles["1001"],
      pickupLocation: "Exhibition Hall",
      dropoffLocation: "Tech Square Eastbound",
      pickupTime: makeDate(3, 10, 0),
      status: "Scheduled",
    },
    {
      student: student2,
      driver: driver1,
      vehicle: vehicles["1001"],
      pickupLocation: "Stamps Health Services",
      dropoffLocation: "Eighth Street Apartments",
      pickupTime: makeDate(-1, 13, 0),
      status: "Completed",
    },

    // Michael + driver3 + vehicle 1003
    {
      student: student3,
      driver: driver3,
      vehicle: vehicles["1003"],
      pickupLocation: "Ferst Center for the Arts",
      dropoffLocation: "Student Center",
      pickupTime: makeDate(0, 8, 30),
      status: "Scheduled",
    },
    {
      student: student3,
      driver: driver3,
      vehicle: vehicles["1003"],
      pickupLocation: "North Avenue Apartments",
      dropoffLocation: "Campus Recreation Center",
      pickupTime: makeDate(2, 13, 0),
      status: "Scheduled",
    },
    {
      student: student3,
      driver: driver1,
      vehicle: vehicles["1004"],
      pickupLocation: "Eighth Street Apartments",
      dropoffLocation: "Clough Undergraduate Learning Commons",
      pickupTime: makeDate(4, 9, 0),
      status: "Scheduled",
    },

    // Sara + driver1 + vehicle 1004
    {
      student: student4,
      driver: driver1,
      vehicle: vehicles["1004"],
      pickupLocation: "West Village Dining",
      dropoffLocation: "Tech Square Eastbound",
      pickupTime: makeDate(1, 10, 30),
      status: "Scheduled",
    },
    {
      student: student4,
      driver: driver2,
      vehicle: vehicles["1005"],
      pickupLocation: "Student Center",
      dropoffLocation: "Ferst Center for the Arts",
      pickupTime: makeDate(3, 14, 0),
      status: "Scheduled",
    },
    {
      student: student4,
      driver: driver3,
      vehicle: vehicles["1003"],
      pickupLocation: "Exhibition Hall",
      dropoffLocation: "Stamps Health Services",
      pickupTime: makeDate(-1, 11, 0),
      status: "Completed",
    },
  ];

  let created = 0;
  let skipped = 0;

  for (const t of routeTemplates) {
    const pickupLoc = locations[t.pickupLocation];
    const dropoffLoc = locations[t.dropoffLocation];
    if (!pickupLoc || !dropoffLoc) continue;

    const existing = await routesCol.findOne({
      "student._id": t.student._id,
      pickupLocation: pickupLoc._id,
      dropoffLocation: dropoffLoc._id,
      scheduledPickupTime: t.pickupTime,
    });
    if (existing) {
      skipped++;
      continue;
    }

    const windowStart = addMinutes(t.pickupTime, -30);
    const windowEnd = addMinutes(t.pickupTime, 30);

    let estimatedDropoffTime: Date | undefined;
    try {
      const secs = await getMapboxTravelDuration(
        pickupLoc.latitude,
        pickupLoc.longitude,
        dropoffLoc.latitude,
        dropoffLoc.longitude,
        t.pickupTime,
      );
      if (secs !== null) {
        estimatedDropoffTime = new Date(t.pickupTime.getTime() + secs * 1000);
      }
    } catch {
      /* skip if Mapbox unavailable */
    }

    await routesCol.insertOne({
      pickupLocation: pickupLoc._id,
      dropoffLocation: dropoffLoc._id,
      student: makeEmbed(t.student as unknown as Record<string, unknown>),
      driver: makeEmbed(t.driver as unknown as Record<string, unknown>),
      vehicle: makeVehicleEmbed(t.vehicle),
      scheduledPickupTime: t.pickupTime,
      pickupWindowStart: windowStart,
      pickupWindowEnd: windowEnd,
      estimatedDropoffTime,
      status: t.status,
    });
    created++;
  }

  console.log(`\n– Routes: created ${created}, skipped ${skipped}`);
  console.log("\nSeed complete!");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
