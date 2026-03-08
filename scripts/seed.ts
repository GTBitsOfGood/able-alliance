/**
 * Seed script for local development.
 *
 * Run via:  npx tsx scripts/seed.ts [mongodb-url]
 *       or:  npm run seed [-- mongodb-url]
 *
 * Optional: pass MongoDB URL as first argument. For Docker Mongo from host use:
 *   npx tsx scripts/seed.ts "mongodb://localhost:27017/able-alliance?replicaSet=rs0&directConnection=true"
 * (directConnection=true stops the driver from following the replica set member hostname "mongo".)
 * Otherwise uses MONGODB_URI from the environment, or a default.
 *
 * Idempotent — checks for existing data before inserting.
 */

import mongoose from "mongoose";

let MONGODB_URI =
  process.argv[2] ??
  process.env.MONGODB_URI ??
  "mongodb://localhost:27017/able-alliance";

// When connecting to Docker Mongo from host, replica set advertises hostname "mongo" which doesn't resolve.
// Force the driver to use only the URI host by adding directConnection=true.
if (
  MONGODB_URI.includes("localhost") &&
  MONGODB_URI.includes("replicaSet=") &&
  !MONGODB_URI.includes("directConnection=")
) {
  MONGODB_URI += (MONGODB_URI.includes("?") ? "&" : "?") + "directConnection=true";
}

async function seed() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  // ---------- Users ----------
  const usersCol = db.collection("users");

  let student = await usersCol.findOne({ email: "gburdell3@gatech.edu" });
  if (!student) {
    const res = await usersCol.insertOne({
      name: "George P. Burdell",
      email: "gburdell3@gatech.edu",
      type: "Student",
      studentInfo: {
        GTID: "903123456",
        notes: "",
        accessibilityNeeds: undefined,
      },
    });
    student = {
      _id: res.insertedId,
      name: "George P. Burdell",
      email: "gburdell3@gatech.edu",
      type: "Student",
      studentInfo: { GTID: "903123456" },
    };
    console.log("✓ Created student: George P. Burdell");
  } else {
    console.log("– Student already exists");
  }

  let driver = await usersCol.findOne({ email: "driver1@gatech.edu" });
  if (!driver) {
    const res = await usersCol.insertOne({
      name: "Test Driver",
      email: "driver1@gatech.edu",
      type: "Driver",
    });
    driver = {
      _id: res.insertedId,
      name: "Test Driver",
      email: "driver1@gatech.edu",
      type: "Driver",
    };
    console.log("✓ Created driver: Test Driver");
  } else {
    console.log("– Driver already exists");
  }

  let admin = await usersCol.findOne({ email: "admin@gatech.edu" });
  if (!admin) {
    const res = await usersCol.insertOne({
      name: "Admin User",
      email: "admin@gatech.edu",
      type: "Admin",
    });
    admin = {
      _id: res.insertedId,
      name: "Admin User",
      email: "admin@gatech.edu",
      type: "Admin",
    };
    console.log("✓ Created admin: Admin User");
  } else {
    console.log("– Admin already exists");
  }

  // ---------- Locations ----------
  const locsCol = db.collection("locations");

  let pickup = await locsCol.findOne({ name: "Exhibition Hall" });
  if (!pickup) {
    const res = await locsCol.insertOne({
      name: "Exhibition Hall",
      latitude: 33.7756,
      longitude: -84.4027,
    });
    pickup = { _id: res.insertedId, name: "Exhibition Hall" };
    console.log("✓ Created location: Exhibition Hall");
  } else {
    console.log("– Location Exhibition Hall exists");
  }

  let dropoff = await locsCol.findOne({ name: "Tech Square Eastbound" });
  if (!dropoff) {
    const res = await locsCol.insertOne({
      name: "Tech Square Eastbound",
      latitude: 33.7767,
      longitude: -84.3891,
    });
    dropoff = { _id: res.insertedId, name: "Tech Square Eastbound" };
    console.log("✓ Created location: Tech Square Eastbound");
  } else {
    console.log("– Location Tech Square Eastbound exists");
  }

  let dropoff2 = await locsCol.findOne({ name: "Student Center" });
  if (!dropoff2) {
    const res = await locsCol.insertOne({
      name: "Student Center",
      latitude: 33.7739,
      longitude: -84.3983,
    });
    dropoff2 = { _id: res.insertedId, name: "Student Center" };
    console.log("✓ Created location: Student Center");
  } else {
    console.log("– Location Student Center exists");
  }

  // ---------- Vehicle ----------
  const vehCol = db.collection("vehicles");

  let vehicle = await vehCol.findOne({ licensePlate: "RVG1730" });
  if (!vehicle) {
    const res = await vehCol.insertOne({
      name: "2026 Honda HR-V",
      licensePlate: "RVG1730",
      description: "White SUV",
      accessibility: "Wheelchair",
      seatCount: 4,
    });
    vehicle = {
      _id: res.insertedId,
      name: "2026 Honda HR-V",
      licensePlate: "RVG1730",
      description: "White SUV",
      accessibility: "Wheelchair",
      seatCount: 4,
    };
    console.log("✓ Created vehicle: 2026 Honda HR-V (RVG1730)");
  } else {
    console.log("– Vehicle RVG1730 exists");
  }

  // ---------- Routes (this week + next week) ----------
  const routesCol = db.collection("routes");

  const now = new Date();

  const getWeekStart = (offset: 0 | 1): Date => {
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek + offset * 7);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const withDayAndTime = (
    weekStart: Date,
    dayOffset: number,
    hour: number,
    minute: number,
  ): Date => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayOffset);
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const studentEmbed = {
    _id: student._id,
    name: student.name,
    email: student.email,
    type: "Student",
    studentInfo: (student as Record<string, unknown>).studentInfo ?? {
      GTID: "903123456",
    },
  };

  const driverEmbed = {
    _id: driver._id,
    name: driver.name,
    email: driver.email,
    type: "Driver",
  };

  const vehicleEmbed = {
    _id: vehicle._id,
    name: vehicle.name,
    licensePlate: (vehicle as Record<string, unknown>).licensePlate,
    description: (vehicle as Record<string, unknown>).description,
    accessibility: (vehicle as Record<string, unknown>).accessibility,
    seatCount: (vehicle as Record<string, unknown>).seatCount,
  };

  const pickupId = (pickup as { _id: unknown })._id;
  const dropoffId = (dropoff as { _id: unknown })._id;
  const dropoff2Id = (dropoff2 as { _id: unknown })._id;

  const thisWeekStart = getWeekStart(0);
  const nextWeekStart = getWeekStart(1);

  const routeTemplates = [
    {
      label: "this week Sunday 10:00",
      dropoffLocation: dropoffId,
      scheduledPickupTime: withDayAndTime(thisWeekStart, 0, 10, 0),
    },
    {
      label: "this week Monday 14:30",
      dropoffLocation: dropoffId,
      scheduledPickupTime: withDayAndTime(thisWeekStart, 1, 14, 30),
    },
    {
      label: "this week Wednesday 16:00",
      dropoffLocation: dropoff2Id,
      scheduledPickupTime: withDayAndTime(thisWeekStart, 3, 16, 0),
    },
    {
      label: "this week Friday 11:15",
      dropoffLocation: dropoffId,
      scheduledPickupTime: withDayAndTime(thisWeekStart, 5, 11, 15),
    },
    {
      label: "next week Monday 09:30",
      dropoffLocation: dropoffId,
      scheduledPickupTime: withDayAndTime(nextWeekStart, 1, 9, 30),
    },
    {
      label: "next week Tuesday 14:00",
      dropoffLocation: dropoff2Id,
      scheduledPickupTime: withDayAndTime(nextWeekStart, 2, 14, 0),
    },
    {
      label: "next week Thursday 16:30",
      dropoffLocation: dropoffId,
      scheduledPickupTime: withDayAndTime(nextWeekStart, 4, 16, 30),
    },
    {
      label: "next week Saturday 12:15",
      dropoffLocation: dropoff2Id,
      scheduledPickupTime: withDayAndTime(nextWeekStart, 6, 12, 15),
    },
  ];

  let createdRoutes = 0;
  let existingSeedRoutes = 0;

  for (const template of routeTemplates) {
    const existing = await routesCol.findOne({
      "driver._id": driver._id,
      pickupLocation: pickupId,
      dropoffLocation: template.dropoffLocation,
      scheduledPickupTime: template.scheduledPickupTime,
    });

    if (existing) {
      existingSeedRoutes += 1;
      continue;
    }

    await routesCol.insertOne({
      pickupLocation: pickupId,
      dropoffLocation: template.dropoffLocation,
      student: studentEmbed,
      driver: driverEmbed,
      vehicle: vehicleEmbed,
      scheduledPickupTime: template.scheduledPickupTime,
      status: "Scheduled",
    });

    createdRoutes += 1;
    console.log(`✓ Created route: ${template.label}`);
  }

  console.log(
    `– Routes summary: created ${createdRoutes}, already existed ${existingSeedRoutes}`,
  );

  console.log("\nSeed complete!");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
