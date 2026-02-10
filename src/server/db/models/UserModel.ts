import mongoose, { Schema } from "mongoose";
import type { BaseUserInput, StudentInput } from "@/utils/types/user";

export type IBaseUser = BaseUserInput;
export type IStudentUser = StudentInput;

const BaseUserSchema: Schema<IBaseUser> = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    type: {
      type: String,
      required: true,
      enum: ["Student", "Driver", "Admin", "SuperAdmin"],
    },
  },
  {
    discriminatorKey: "type",
    versionKey: false,
  },
);

const StudentSchema: Schema<IStudentUser> = new Schema({
  studentInfo: {
    notes: { type: String },
    accessibilityNeeds: {
      type: String,
      enum: ["Wheelchair", "LowMobility"],
    },
    GTID: { type: String, required: true },
  },
});

const BaseUserModel =
  (mongoose.models.User as mongoose.Model<IBaseUser>) ??
  mongoose.model<IBaseUser>("User", BaseUserSchema);

const StudentModel =
  (mongoose.models.Student as mongoose.Model<IStudentUser>) ??
  BaseUserModel.discriminator<IStudentUser>("Student", StudentSchema);

// Blank discriminators so Mongoose accepts type "Driver" | "Admin" | "SuperAdmin" (no extra fields)
const emptySchema = new Schema({});
if (!mongoose.models.Driver)
  BaseUserModel.discriminator<IBaseUser>("Driver", emptySchema);
if (!mongoose.models.Admin)
  BaseUserModel.discriminator<IBaseUser>("Admin", emptySchema);
if (!mongoose.models.SuperAdmin)
  BaseUserModel.discriminator<IBaseUser>("SuperAdmin", emptySchema);

export { BaseUserModel as UserModel, StudentModel };
export default BaseUserModel;
