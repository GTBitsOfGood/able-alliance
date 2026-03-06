// Remove in prod!!
import connectMongoDB from "../mongodb";
import UserModel, { StudentModel } from "../models/UserModel";

const TEST_USERS = [
  {
    firstName: "George",
    lastName: "Burdell",
    email: "gburdell3@gatech.edu",
    type: "Student" as const,
    studentInfo: {},
  },
  {
    firstName: "Admin",
    lastName: "User",
    email: "admin@gatech.edu",
    type: "Admin" as const,
  },
  {
    firstName: "Test",
    lastName: "Driver",
    email: "driver1@gatech.edu",
    type: "Driver" as const,
  },
];

export async function initTestUsers() {
  await connectMongoDB();

  for (const user of TEST_USERS) {
    const existing = await UserModel.findOne({ email: user.email });
    if (existing) {
      console.log(`[Init] Test user already exists: ${user.email}`);
      continue;
    }

    if (user.type === "Student") {
      await StudentModel.create(user);
    } else {
      await UserModel.create(user);
    }
    console.log(`[Init] Test user created: ${user.email}`);
  }
}