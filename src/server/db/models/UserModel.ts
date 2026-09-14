import mongoose, { Schema } from "mongoose";
import type {
  BaseUserInput,
  StudentInput,
  DriverInput,
} from "@/utils/types/user";
import type { GoogleCalendarConnection } from "@/utils/types/googleCalendar";

export type IBaseUser = BaseUserInput & {
  googleCalendar?: GoogleCalendarConnection;
};
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

/**
 * Per-user Google Calendar connection.
 *
 * `refreshTokenEncrypted` is `select: false` so it never leaves the DB layer by
 * accident (e.g. via the generic `GET /api/users/:id` handler). Read it only
 * through GoogleCalendarAction, which opts in explicitly.
 */
const GoogleCalendarSchema: Schema = new Schema(
  {
    refreshTokenEncrypted: { type: String, select: false },
    calendarId: { type: String, default: "primary" },
    connectedAt: { type: Date },
    lastSyncedAt: { type: Date },
    // Which Google account is connected, so the UI can show it when disconnecting.
    googleEmail: { type: String },
    // Number of ride events on the calendar as of the last successful sync.
    syncedEventCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const BaseUserSchema: Schema<IBaseUser> = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    preferredName: { type: String },
    email: { type: String, required: true, unique: true },
    type: {
      type: String,
      required: true,
      enum: ["Student", "Driver", "Admin", "SuperAdmin"],
    },
    googleCalendar: { type: GoogleCalendarSchema, required: false },
  },
  {
    discriminatorKey: "type",
    versionKey: false,
  },
);

const StudentSchema: Schema<IStudentUser> = new Schema({
  studentInfo: {
    notes: { type: String },
    accessibilityNeeds: [{ type: String }],
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
export { BaseUserSchema, StudentSchema, DriverSchema, GoogleCalendarSchema };
export default BaseUserModel;
