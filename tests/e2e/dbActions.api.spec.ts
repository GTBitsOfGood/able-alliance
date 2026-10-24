/** Regression coverage for database action error/status contracts. */
import { test, expect } from "./fixtures";
import { PERSONAS, VEHICLE } from "./seed";

test("expected database failures use stable HTTP statuses", async ({
  apiAs,
}) => {
  const admin = await apiAs("admin");

  const nullScheduleBody = await admin.post("/api/routes/schedule", {
    data: null,
  });
  expect(nullScheduleBody.status(), await nullScheduleBody.text()).toBe(400);

  const invalidLocation = await admin.get("/api/locations/not-a-uuid");
  expect(invalidLocation.status(), await invalidLocation.text()).toBe(400);

  const missingLocation = await admin.get(
    "/api/locations/00000000-0000-4000-8000-999999999999",
  );
  expect(missingLocation.status(), await missingLocation.text()).toBe(404);

  const invalidAccommodationUser = await admin.post("/api/users", {
    data: {
      firstName: "Invalid",
      lastName: "Accommodation",
      username: `badaccommodation${Date.now()}`,
      email: `badaccommodation${Date.now()}@example.edu`,
      type: "Student",
      studentInfo: { accessibilityNeeds: ["not-provisioned"] },
    },
  });
  expect(
    invalidAccommodationUser.status(),
    await invalidAccommodationUser.text(),
  ).toBe(400);

  const duplicateUser = await admin.post("/api/users", {
    data: {
      firstName: "Duplicate",
      lastName: "Student",
      username: PERSONAS.student.username,
      email: "duplicate-check@example.edu",
      type: "Student",
      studentInfo: {},
    },
  });
  expect(duplicateUser.status(), await duplicateUser.text()).toBe(409);

  const duplicateVehicleId = await admin.post("/api/vehicles", {
    data: {
      vehicleId: VEHICLE.vehicleId,
      name: "Duplicate business ID",
      licensePlate: "E2E9001",
      accessibility: "Wheelchair",
      seatCount: 4,
    },
  });
  expect(duplicateVehicleId.status(), await duplicateVehicleId.text()).toBe(
    409,
  );

  const duplicatePlate = await admin.post("/api/vehicles", {
    data: {
      vehicleId: "e2e-duplicate-plate",
      name: "Duplicate plate",
      licensePlate: VEHICLE.licensePlate,
      accessibility: "Wheelchair",
      seatCount: 4,
    },
  });
  expect(duplicatePlate.status(), await duplicatePlate.text()).toBe(409);

  const created = await admin.post("/api/vehicles", {
    data: {
      vehicleId: "e2e-temp-vehicle",
      name: "Temporary vehicle",
      licensePlate: "E2E9002",
      accessibility: "Wheelchair",
      seatCount: 4,
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const tempVehicle = (await created.json()) as { id: string };
  try {
    const duplicateIdUpdate = await admin.patch(
      `/api/vehicles/${tempVehicle.id}`,
      {
        data: { vehicleId: VEHICLE.vehicleId },
      },
    );
    expect(duplicateIdUpdate.status(), await duplicateIdUpdate.text()).toBe(
      409,
    );

    const duplicatePlateUpdate = await admin.patch(
      `/api/vehicles/${tempVehicle.id}`,
      {
        data: { licensePlate: VEHICLE.licensePlate },
      },
    );
    expect(
      duplicatePlateUpdate.status(),
      await duplicatePlateUpdate.text(),
    ).toBe(409);
  } finally {
    const deleted = await admin.delete(`/api/vehicles/${tempVehicle.id}`);
    expect(deleted.status(), await deleted.text()).toBe(200);
  }

  const student = await apiAs("student");
  const beforeResponse = await student.get(`/api/users/${PERSONAS.student.id}`);
  expect(beforeResponse.status(), await beforeResponse.text()).toBe(200);
  const before = (await beforeResponse.json()) as {
    preferredName: string | null;
    settings: { dailySummary: boolean };
    studentInfo: {
      notes: string | null;
      accessibilityNeeds: Array<{ label: string }>;
    };
  };

  const rejectedPatch = await student.patch(
    `/api/users/${PERSONAS.student.id}`,
    {
      data: {
        preferredName: "Must not persist",
        notes: "Must not persist",
        settings: { dailySummary: !before.settings.dailySummary },
        accessibilityNeeds: ["not-a-provisioned-accommodation"],
      },
    },
  );
  expect(rejectedPatch.status(), await rejectedPatch.text()).toBe(400);

  const afterResponse = await student.get(`/api/users/${PERSONAS.student.id}`);
  expect(afterResponse.status(), await afterResponse.text()).toBe(200);
  const after = await afterResponse.json();
  expect(after.preferredName).toBe(before.preferredName);
  expect(after.settings.dailySummary).toBe(before.settings.dailySummary);
  expect(after.studentInfo.notes).toBe(before.studentInfo.notes);
  expect(after.studentInfo.accessibilityNeeds).toEqual(
    before.studentInfo.accessibilityNeeds,
  );
});
