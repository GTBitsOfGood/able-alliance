import connectMongoDB from "../mongodb";
import UserModel, { StudentModel, DriverModel } from "../models/UserModel";
import type { BaseUserInput, StudentInput, Shift } from "@/utils/types/user";
import {
  UserAlreadyExistsException,
  UserNotFoundException,
} from "@/utils/exceptions/user";

type UserSettings = BaseUserInput["settings"];
type NotificationSettingsUpdate = Partial<UserSettings["notifications"]>;

export async function createUser(data: BaseUserInput | StudentInput) {
  await connectMongoDB();

  // Both email and GT username are unique identities; check each so a clash
  // surfaces as a 400 rather than a Mongo duplicate-key error.
  const existing = await UserModel.findOne({
    $or: [{ email: data.email }, { gtUsername: data.gtUsername }],
  });
  if (existing) {
    throw new UserAlreadyExistsException(
      existing.email === data.email
        ? "User with this email already exists"
        : "User with this GT username already exists",
    );
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
 * Look up an existing user by their GT Account username — the CAS `cas:user`
 * value, and the only identity CAS guarantees on every successful validation.
 *
 * Users are never auto-provisioned from CAS: a successful CAS login for
 * someone with no record here is a failed login.
 */
export async function getProvisionedUserFromCAS(gtUsername: string) {
  await connectMongoDB();

  const existing = await UserModel.findOne({ gtUsername }).lean();
  if (existing) {
    return existing;
  }

  throw new UserNotFoundException(
    `No provisioned user found for GT username: ${gtUsername}`,
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

export async function updatePreferredName(
  id: string,
  preferredName: string | null,
) {
  await connectMongoDB();

  const user = await UserModel.findById(id);
  if (!user) {
    return null;
  }

  (user as unknown as { preferredName?: string | null }).preferredName =
    preferredName ?? undefined;

  const saved = await user.save();
  return saved.toObject();
}

export async function updateStudentInfo(
  id: string,
  update: {
    notes?: string | null;
    accessibilityNeeds?: string[] | null;
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
        studentInfo?: { notes?: string; accessibilityNeeds?: string[] };
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

export async function updateNotificationSettings(
  id: string,
  settings: {
    notifications?: NotificationSettingsUpdate;
  },
) {
  await connectMongoDB();

  const user = await UserModel.findById(id);
  if (!user) {
    return null;
  }

  const theUser = user as unknown as { settings?: UserSettings };
  theUser.settings = {
    ...theUser.settings,
    notifications: {
      dailySummary: false,
      driverAssigned: false,
      driverEnRoute: false,
      rideCancelled: false,
      rideAssigned: false,
      rideCompleted: false,
      ...theUser.settings?.notifications,
      ...settings.notifications,
    },
  };

  const saved = await user.save();
  return saved.toObject();
}
