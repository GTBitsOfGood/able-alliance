// Remove in prod!!
import { db } from "@db";
import type { Prisma } from "@db/generated/client";

const TEST_USERS = [
  {
    firstName: "George",
    lastName: "Burdell",
    username: "gburdell3",
    email: "gburdell3@gatech.edu",
    type: "Student" as const,
    studentInfo: { create: {} },
  },
  {
    firstName: "Admin",
    lastName: "User",
    username: "adminuser",
    email: "adminuser@gatech.edu",
    type: "Admin" as const,
  },
  {
    firstName: "Test",
    lastName: "Driver",
    username: "driver1",
    email: "driver1@gatech.edu",
    type: "Driver" as const,
  },
] satisfies Prisma.UserCreateInput[];

export async function initTestUsers() {
  for (const user of TEST_USERS) {
    const existing = await db.user.findUnique({
      where: { username: user.username },
    });
    if (existing) {
      console.log(`[Init] Test user already exists: ${user.email}`);
      continue;
    }

    await db.user.create({
      data: { ...user, settings: { create: {} } },
    });
    console.log(`[Init] Test user created: ${user.email}`);
  }
}
