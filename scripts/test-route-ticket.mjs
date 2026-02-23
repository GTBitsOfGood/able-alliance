/**
 * Acceptance tests for the Route workflow ticket.
 *
 * Prerequisites: Dev server running (npm run dev), MongoDB running.
 * Usage: node -r dotenv/config scripts/test-route-ticket.mjs
 * Optional: BASE_URL=http://localhost:3000 (default)
 *
 * Tests:
 * 1. User Zod schema rejects non-GT emails
 * 2. Route schema includes status enum (Requested default)
 * 3. Route stores embedded student (and after schedule: driver, vehicle)
 * 4. Create route: defaults Requested, rejects driver/vehicle/status in body
 * 5. POST /api/routes/schedule: updates status, assigns driver and vehicle
 * 6. POST /api/routes/cancel: sets status to Cancelled by Student
 * 7. POST /api/routes/complete: sets status to Completed
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

function log(msg) {
  console.log(`[test] ${msg}`);
}

function fail(msg, detail) {
  console.error(`[FAIL] ${msg}`);
  if (detail) console.error(detail);
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts.headers },
  });
  const data = res.json ? await res.json().catch(() => ({})) : {};
  return { res, data };
}

// --- Seed data (created via API) ---
let pickupLocationId, dropoffLocationId, studentId, driverId, vehicleId;

async function seed() {
  log("Seeding: locations, student, driver, vehicle...");

  const { res: rLoc1, data: loc1 } = await fetchJson(
    `${BASE_URL}/api/locations`,
    {
      method: "POST",
      body: JSON.stringify({
        name: `Test Pickup ${Date.now()}`,
        latitude: 33.7756,
        longitude: -84.3963,
      }),
    },
  );
  if (rLoc1.status !== 201 || !loc1._id) {
    fail("Create pickup location", { status: rLoc1.status, data: loc1 });
    process.exit(1);
  }
  pickupLocationId = loc1._id;

  const { res: rLoc2, data: loc2 } = await fetchJson(
    `${BASE_URL}/api/locations`,
    {
      method: "POST",
      body: JSON.stringify({
        name: `Test Dropoff ${Date.now()}`,
        latitude: 33.776,
        longitude: -84.397,
      }),
    },
  );
  if (rLoc2.status !== 201 || !loc2._id) {
    fail("Create dropoff location", { status: rLoc2.status, data: loc2 });
    process.exit(1);
  }
  dropoffLocationId = loc2._id;

  const { res: rStudent, data: student } = await fetchJson(
    `${BASE_URL}/api/users`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "Test Student",
        email: `teststudent${Date.now()}@gatech.edu`,
        type: "Student",
        studentInfo: { GTID: "123456789" },
      }),
    },
  );
  if (rStudent.status !== 201 || !student._id) {
    fail("Create student", { status: rStudent.status, data: student });
    process.exit(1);
  }
  studentId = student._id;

  const { res: rDriver, data: driver } = await fetchJson(
    `${BASE_URL}/api/users`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "Test Driver",
        email: `testdriver${Date.now()}@gatech.edu`,
        type: "Driver",
      }),
    },
  );
  if (rDriver.status !== 201 || !driver._id) {
    fail("Create driver", { status: rDriver.status, data: driver });
    process.exit(1);
  }
  driverId = driver._id;

  const { res: rVehicle, data: vehicle } = await fetchJson(
    `${BASE_URL}/api/vehicles`,
    {
      method: "POST",
      body: JSON.stringify({
        name: "Test Van",
        licensePlate: `TEST-${Date.now()}`,
        accessibility: "Wheelchair",
        seatCount: 4,
      }),
    },
  );
  if (rVehicle.status !== 201 || !vehicle._id) {
    fail("Create vehicle", { status: rVehicle.status, data: vehicle });
    process.exit(1);
  }
  vehicleId = vehicle._id;

  log("Seed done.");
}

// --- Tests ---

async function test1_userZodRejectsNonGTEmail() {
  log("1. User Zod schema rejects non-GT emails");
  const { res, data } = await fetchJson(`${BASE_URL}/api/users`, {
    method: "POST",
    body: JSON.stringify({
      name: "Bad User",
      email: "someone@gmail.com",
      type: "Driver",
    }),
  });
  if (res.status === 400) {
    log("   PASS: non-GT email rejected with 400");
    return true;
  }
  fail("Expected 400 for non-GT email", { status: res.status, data });
  return false;
}

async function test2_routeStatusEnumAndDefault() {
  log("2. Route schema includes status enum; create defaults to Requested");
  const { res, data } = await fetchJson(`${BASE_URL}/api/routes`, {
    method: "POST",
    body: JSON.stringify({
      pickupLocation: pickupLocationId,
      dropoffLocation: dropoffLocationId,
      student: studentId,
      scheduledPickupTime: new Date(Date.now() + 86400000).toISOString(),
    }),
  });
  if (res.status !== 201 || !data._id) {
    fail("Create route failed", { status: res.status, data });
    return { ok: false };
  }
  if (data.status !== "Requested") {
    fail("Expected status Requested", { status: data.status });
    return { ok: false, routeId: data._id };
  }
  log("   PASS: route created with status Requested");
  return { ok: true, routeId: data._id };
}

async function test3_embeddedObjects(routeId) {
  log("3. Route stores embedded student (and driver/vehicle after schedule)");
  const { res: getRes, data: route } = await fetchJson(
    `${BASE_URL}/api/routes?id=${routeId}`,
  );
  if (getRes.status !== 200 || !route) {
    fail("GET route failed", { status: getRes.status });
    return false;
  }
  if (
    !route.student ||
    typeof route.student !== "object" ||
    !route.student.name ||
    !route.student.email
  ) {
    fail("Route student should be embedded object with name, email", {
      student: route.student,
    });
    return false;
  }
  log("   PASS: student is embedded object");

  const { res: sRes, data: scheduled } = await fetchJson(
    `${BASE_URL}/api/routes/schedule`,
    {
      method: "POST",
      body: JSON.stringify({
        routeId,
        driverId,
        vehicleId,
      }),
    },
  );
  if (sRes.status !== 200) {
    fail("Schedule failed", { status: sRes.status, data: scheduled });
    return false;
  }
  if (
    !scheduled.driver ||
    typeof scheduled.driver !== "object" ||
    !scheduled.driver.name ||
    !scheduled.driver.email
  ) {
    fail("Scheduled route should have embedded driver", {
      driver: scheduled.driver,
    });
    return false;
  }
  if (
    !scheduled.vehicle ||
    typeof scheduled.vehicle !== "object" ||
    !scheduled.vehicle.name
  ) {
    fail("Scheduled route should have embedded vehicle", {
      vehicle: scheduled.vehicle,
    });
    return false;
  }
  if (scheduled.status !== "Scheduled") {
    fail("Expected status Scheduled", { status: scheduled.status });
    return false;
  }
  log("   PASS: driver and vehicle embedded after schedule");
  return true;
}

async function test4_createRejectsDriverVehicleStatus() {
  log("4. Create route rejects driver, vehicle, and status in body");
  const baseBody = {
    pickupLocation: pickupLocationId,
    dropoffLocation: dropoffLocationId,
    student: studentId,
    scheduledPickupTime: new Date(Date.now() + 86400000 * 2).toISOString(),
  };

  const { res: rDriver } = await fetchJson(`${BASE_URL}/api/routes`, {
    method: "POST",
    body: JSON.stringify({ ...baseBody, driver: driverId }),
  });
  if (rDriver.status !== 400) {
    fail("Expected 400 when sending driver in create", {
      status: rDriver.status,
    });
    return false;
  }

  const { res: rVehicle } = await fetchJson(`${BASE_URL}/api/routes`, {
    method: "POST",
    body: JSON.stringify({ ...baseBody, vehicle: vehicleId }),
  });
  if (rVehicle.status !== 400) {
    fail("Expected 400 when sending vehicle in create", {
      status: rVehicle.status,
    });
    return false;
  }

  const { res: rStatus } = await fetchJson(`${BASE_URL}/api/routes`, {
    method: "POST",
    body: JSON.stringify({ ...baseBody, status: "Scheduled" }),
  });
  if (rStatus.status !== 400) {
    fail("Expected 400 when sending status in create", {
      status: rStatus.status,
    });
    return false;
  }

  log("   PASS: driver, vehicle, and status rejected on create");
  return true;
}

async function test5_scheduleEndpoint() {
  log("5. POST /api/routes/schedule assigns driver/vehicle and sets Scheduled");
  const { res: createRes, data: created } = await fetchJson(
    `${BASE_URL}/api/routes`,
    {
      method: "POST",
      body: JSON.stringify({
        pickupLocation: pickupLocationId,
        dropoffLocation: dropoffLocationId,
        student: studentId,
        scheduledPickupTime: new Date(Date.now() + 86400000 * 3).toISOString(),
      }),
    },
  );
  if (createRes.status !== 201 || !created._id) {
    fail("Create route for schedule test", {
      status: createRes.status,
      data: created,
    });
    return false;
  }
  const { res: sRes, data: updated } = await fetchJson(
    `${BASE_URL}/api/routes/schedule`,
    {
      method: "POST",
      body: JSON.stringify({
        routeId: created._id,
        driverId,
        vehicleId,
      }),
    },
  );
  if (sRes.status !== 200) {
    fail("Schedule returned non-200", { status: sRes.status, data: updated });
    return false;
  }
  if (updated.status !== "Scheduled" || !updated.driver || !updated.vehicle) {
    fail("Schedule should set status and driver/vehicle", {
      status: updated.status,
      hasDriver: !!updated.driver,
      hasVehicle: !!updated.vehicle,
    });
    return false;
  }
  log("   PASS: schedule endpoint works");
  return true;
}

async function test6_cancelEndpoint() {
  log("6. POST /api/routes/cancel sets status to Cancelled by Student");
  const { res: createRes, data: created } = await fetchJson(
    `${BASE_URL}/api/routes`,
    {
      method: "POST",
      body: JSON.stringify({
        pickupLocation: pickupLocationId,
        dropoffLocation: dropoffLocationId,
        student: studentId,
        scheduledPickupTime: new Date(Date.now() + 86400000 * 4).toISOString(),
      }),
    },
  );
  if (createRes.status !== 201 || !created._id) {
    fail("Create route for cancel test", { status: createRes.status });
    return false;
  }
  const { res: cRes, data: updated } = await fetchJson(
    `${BASE_URL}/api/routes/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ routeId: created._id }),
    },
  );
  if (cRes.status !== 200) {
    fail("Cancel returned non-200", { status: cRes.status, data: updated });
    return false;
  }
  if (updated.status !== "Cancelled by Student") {
    fail("Expected status Cancelled by Student", { status: updated.status });
    return false;
  }
  log("   PASS: cancel endpoint sets Cancelled by Student");
  return true;
}

async function test7_completeEndpoint() {
  log("7. POST /api/routes/complete sets status to Completed");
  const { res: createRes, data: created } = await fetchJson(
    `${BASE_URL}/api/routes`,
    {
      method: "POST",
      body: JSON.stringify({
        pickupLocation: pickupLocationId,
        dropoffLocation: dropoffLocationId,
        student: studentId,
        scheduledPickupTime: new Date(Date.now() + 86400000 * 5).toISOString(),
      }),
    },
  );
  if (createRes.status !== 201 || !created._id) {
    fail("Create route for complete test", { status: createRes.status });
    return false;
  }
  const { res: cRes, data: updated } = await fetchJson(
    `${BASE_URL}/api/routes/complete`,
    {
      method: "POST",
      body: JSON.stringify({ routeId: created._id }),
    },
  );
  if (cRes.status !== 200) {
    fail("Complete returned non-200", { status: cRes.status, data: updated });
    return false;
  }
  if (updated.status !== "Completed") {
    fail("Expected status Completed", { status: updated.status });
    return false;
  }
  log("   PASS: complete endpoint sets Completed");
  return true;
}

async function main() {
  console.log("\n--- Route ticket acceptance tests ---\n");
  let passed = 0;
  let failed = 0;

  try {
    await seed();
  } catch (e) {
    console.error("Seed failed:", e);
    process.exit(1);
  }

  if (await test1_userZodRejectsNonGTEmail()) passed++;
  else failed++;

  const t2 = await test2_routeStatusEnumAndDefault();
  if (t2.ok) passed++;
  else failed++;

  if (t2.routeId) {
    if (await test3_embeddedObjects(t2.routeId)) passed++;
    else failed++;
  } else {
    failed++;
  }

  if (await test4_createRejectsDriverVehicleStatus()) passed++;
  else failed++;

  if (await test5_scheduleEndpoint()) passed++;
  else failed++;

  if (await test6_cancelEndpoint()) passed++;
  else failed++;

  if (await test7_completeEndpoint()) passed++;
  else failed++;

  console.log("\n--- Result ---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
