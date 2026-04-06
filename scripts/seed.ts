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
  MONGODB_URI +=
    (MONGODB_URI.includes("?") ? "&" : "?") + "directConnection=true";
}

async function seed() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  // ---------- Users ----------
  const usersCol = db.collection("users");

  // Student with preferred name
  let student = await usersCol.findOne({ email: "gburdell3@gatech.edu" });
  if (!student) {
    const res = await usersCol.insertOne({
      firstName: "George",
      lastName: "Burdell",
      preferredName: "G",
      email: "gburdell3@gatech.edu",
      type: "Student",
      studentInfo: { accessibilityNeeds: ["Wheelchair", "ExtraTime"] },
    });
    student = {
      _id: res.insertedId,
      firstName: "George",
      lastName: "Burdell",
      preferredName: "G",
      email: "gburdell3@gatech.edu",
      type: "Student",
      studentInfo: { accessibilityNeeds: ["Wheelchair", "ExtraTime"] },
    };
    console.log("✓ Created student: George Burdell (preferred: G)");
  } else {
    console.log("– Student already exists");
  }

  // Student without preferred name
  let student2 = await usersCol.findOne({ email: "jdoe3@gatech.edu" });
  if (!student2) {
    const res = await usersCol.insertOne({
      firstName: "Jane",
      lastName: "Doe",
      email: "jdoe3@gatech.edu",
      type: "Student",
      studentInfo: { notes: "Please call ahead of arrival." },
    });
    student2 = {
      _id: res.insertedId,
      firstName: "Jane",
      lastName: "Doe",
      email: "jdoe3@gatech.edu",
      type: "Student",
      studentInfo: { notes: "Please call ahead of arrival." },
    };
    console.log("✓ Created student: Jane Doe (no preferred name)");
  } else {
    console.log("– Student Jane Doe already exists");
  }

  // Driver with preferred name
  let driver = await usersCol.findOne({ email: "driver1@gatech.edu" });
  if (!driver) {
    const res = await usersCol.insertOne({
      firstName: "Test",
      lastName: "Driver",
      preferredName: "TD",
      email: "driver1@gatech.edu",
      type: "Driver",
    });
    driver = {
      _id: res.insertedId,
      firstName: "Test",
      lastName: "Driver",
      preferredName: "TD",
      email: "driver1@gatech.edu",
      type: "Driver",
    };
    console.log("✓ Created driver: Test Driver (preferred: TD)");
  } else {
    console.log("– Driver already exists");
  }

  // Admin without preferred name
  let admin = await usersCol.findOne({ email: "admin@gatech.edu" });
  if (!admin) {
    const res = await usersCol.insertOne({
      firstName: "Admin",
      lastName: "User",
      email: "admin@gatech.edu",
      type: "Admin",
    });
    admin = {
      _id: res.insertedId,
      firstName: "Admin",
      lastName: "User",
      email: "admin@gatech.edu",
      type: "Admin",
    };
    console.log("✓ Created admin: Admin User (no preferred name)");
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

  // ---------- Routes (today + tomorrow) ----------
  const routesCol = db.collection("routes");

  const now = new Date();

  const getDayStart = (offset: 0 | 1): Date => {
    const date = new Date(now);
    date.setDate(now.getDate() + offset);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  const withTime = (dayStart: Date, hour: number, minute: number): Date => {
    const date = new Date(dayStart);
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  const addMinutes = (date: Date, minutes: number): Date => {
    return new Date(date.getTime() + minutes * 60 * 1000);
  };

  const parseName = (user: Record<string, unknown>): [string, string] => {
    const first = user.firstName as string | undefined;
    const last = user.lastName as string | undefined;
    if (first && last) return [first, last];
    const name = (user.name as string) ?? "";
    const parts = name.trim().split(/\s+/);
    return [parts[0] || "User", parts.slice(1).join(" ") || "Unknown"];
  };

  const [studentFirst, studentLast] = parseName(
    student as Record<string, unknown>,
  );
  const studentEmbed = {
    _id: student._id,
    firstName: studentFirst,
    lastName: studentLast,
    email: student.email,
    type: "Student",
    studentInfo: (student as Record<string, unknown>).studentInfo ?? {},
  };

  const [driverFirst, driverLast] = parseName(
    driver as Record<string, unknown>,
  );
  const driverEmbed = {
    _id: driver._id,
    firstName: driverFirst,
    lastName: driverLast,
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

  const todayStart = getDayStart(0);
  const tomorrowStart = getDayStart(1);

  const makeRoute = (
    label: string,
    dropoffLocation: unknown,
    scheduledPickupTime: Date,
  ) => ({
    label,
    dropoffLocation,
    scheduledPickupTime,
    pickupWindowStart: addMinutes(scheduledPickupTime, -30),
    pickupWindowEnd: addMinutes(scheduledPickupTime, 30),
  });

  const routeTemplates = [
    makeRoute("today 10:00", dropoffId, withTime(todayStart, 10, 0)),
    makeRoute("today 14:30", dropoffId, withTime(todayStart, 14, 30)),
    makeRoute("today 16:00", dropoff2Id, withTime(todayStart, 16, 0)),
    makeRoute("tomorrow 09:30", dropoffId, withTime(tomorrowStart, 9, 30)),
    makeRoute("tomorrow 14:00", dropoff2Id, withTime(tomorrowStart, 14, 0)),
    makeRoute("tomorrow 16:30", dropoffId, withTime(tomorrowStart, 16, 30)),
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
      pickupWindowStart: template.pickupWindowStart,
      pickupWindowEnd: template.pickupWindowEnd,
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
