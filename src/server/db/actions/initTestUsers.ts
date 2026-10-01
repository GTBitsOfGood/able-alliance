// Remove in prod!!
import connectMongoDB from "../mongodb";
import UserModel, { StudentModel } from "../models/UserModel";

const TEST_USERS = [
  {
    firstName: "George",
    lastName: "Burdell",
    username: "gburdell3",
    email: "gburdell3@gatech.edu",
    type: "Student" as const,
    studentInfo: {},
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
];

export async function initTestUsers() {
  await connectMongoDB();

  for (const user of TEST_USERS) {
    const existing = await UserModel.findOne({ username: user.username });
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
