import connectMongoDB from "../mongodb";
import UserModel, { StudentModel, IBaseUser, IStudentUser } from "../models/UserModel";
import type { BaseUserInput, StudentInput } from "@/utils/types/user";
import { UserAlreadyExistsException, UserNotFoundException } from "@/utils/exceptions/user";

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

export async function getUsers(type?: "Student" | "Driver" | "Admin" | "SuperAdmin") {
  await connectMongoDB();
  const query = type ? { type } : {};
  const users = await UserModel.find(query).lean();
  return users;
}

export async function getUserById(id: string) {
  await connectMongoDB();
  const user = await UserModel.findById(id).lean();
  if (!user) {
    throw new UserNotFoundException();
  }
  return user;
}

export async function deleteUser(id: string) {
  await connectMongoDB();
  const user = await UserModel.findByIdAndDelete(id).lean();
  if (!user) {
    throw new UserNotFoundException();
  }
  return user;
}

