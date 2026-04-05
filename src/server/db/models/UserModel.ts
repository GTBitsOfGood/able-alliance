import mongoose, { Schema } from "mongoose";
import type {
  BaseUserInput,
  StudentInput,
  DriverInput,
} from "@/utils/types/user";

export type IBaseUser = BaseUserInput;
export type IStudentUser = StudentInput;
export type IDriverUser = DriverInput;

const ShiftSchema: Schema = new Schema(
  {
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):([0-5]\d)$/,
    },
  },
  { _id: false },
);

const BaseUserSchema: Schema<IBaseUser> = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
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
  },
});

const DriverSchema: Schema<IDriverUser> = new Schema({
  shifts: [ShiftSchema],
});

const BaseUserModel =
  (mongoose.models.User as mongoose.Model<IBaseUser>) ??
  mongoose.model<IBaseUser>("User", BaseUserSchema);

const StudentModel =
  (mongoose.models.Student as mongoose.Model<IStudentUser>) ??
  BaseUserModel.discriminator<IStudentUser>("Student", StudentSchema);

const DriverModel =
  (mongoose.models.Driver as mongoose.Model<IDriverUser>) ??
  BaseUserModel.discriminator<IDriverUser>("Driver", DriverSchema);

// Blank discriminators so Mongoose accepts type "Admin" | "SuperAdmin" (no extra fields)
const emptySchema = new Schema({});
if (!mongoose.models.Admin)
  BaseUserModel.discriminator<IBaseUser>("Admin", emptySchema);
if (!mongoose.models.SuperAdmin)
  BaseUserModel.discriminator<IBaseUser>("SuperAdmin", emptySchema);

export { BaseUserModel as UserModel, StudentModel, DriverModel };
export { BaseUserSchema, StudentSchema, DriverSchema };
export default BaseUserModel;
