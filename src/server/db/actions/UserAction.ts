import connectMongoDB from "../mongodb";
import UserModel, { StudentModel, DriverModel } from "../models/UserModel";
import type { BaseUserInput, StudentInput, Shift } from "@/utils/types/user";
import {
  UserAlreadyExistsException,
  UserNotFoundException,
} from "@/utils/exceptions/user";

interface CASUserData {
  email: string;
  name: string;
}

export async function createUser(data: BaseUserInput | StudentInput) {
  await connectMongoDB();

  const existing = await UserModel.findOne({ email: data.email });
  if (existing) {
    throw new UserAlreadyExistsException();
  }

  if (data.type === "Student") {
    const studentData = data as StudentInput;
    const user = await StudentModel.create(studentData);
    return user.toObject();
  }

  const user = await UserModel.create(data);
  return user.toObject();
}

export async function getUserByEmail(email: string) {
  await connectMongoDB();
  const user = await UserModel.findOne({ email }).lean();
  return user;
}

/**
 * Look up an existing user by their CAS email.
 * Throws UserNotFoundException if the user has not been pre-provisioned.
 */
export async function getProvisionedUserFromCAS(data: CASUserData) {
  await connectMongoDB();

  console.log(`[UserAction] getUserByEmail: ${data.email}`);
  const existing = await UserModel.findOne({ email: data.email }).lean();
  if (existing) {
    console.log(`[UserAction] User found: ${existing._id}`);
    return existing;
  }

  console.log(`[UserAction] User not found: ${data.email}`);
  throw new UserNotFoundException(
    `No provisioned user found for CAS email: ${data.email}`,
  );
}

export async function getUsers(
  type?: "Student" | "Driver" | "Admin" | "SuperAdmin",
) {
  await connectMongoDB();
  const query = type ? { type } : {};
  const users = await UserModel.find(query).lean();
  return users;
}

export async function getUserById(id: string) {
  await connectMongoDB();
  const user = await UserModel.findById(id).lean();
  return user;
}

export async function deleteUser(id: string) {
  await connectMongoDB();
  const deleted = await UserModel.findByIdAndDelete(id).lean();
  return deleted;
}

export async function updateStudentInfo(
  id: string,
  update: {
    notes?: string | null;
    accessibilityNeeds?: "Wheelchair" | "LowMobility" | null;
  },
) {
  await connectMongoDB();

  const student = await StudentModel.findById(id);
  if (!student) {
    return null;
  }

  const currentInfo =
    (
      student as unknown as {
        studentInfo?: { notes?: string; accessibilityNeeds?: string };
      }
    ).studentInfo ?? {};

  const nextInfo = {
    ...currentInfo,
    ...(update.notes !== undefined ? { notes: update.notes ?? "" } : {}),
    ...(update.accessibilityNeeds !== undefined
      ? { accessibilityNeeds: update.accessibilityNeeds ?? undefined }
      : {}),
  };

  (student as unknown as { studentInfo?: typeof nextInfo }).studentInfo =
    nextInfo;

  const saved = await student.save();
  return saved.toObject();
}

export async function updateDriverShifts(id: string, shifts: Shift[]) {
  await connectMongoDB();

  const driver = await DriverModel.findById(id);
  if (!driver) {
    return null;
  }

  (driver as unknown as { shifts: Shift[] }).shifts = shifts;

  const saved = await driver.save();
  return saved.toObject();
}
