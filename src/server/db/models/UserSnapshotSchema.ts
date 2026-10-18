import mongoose, { Schema } from "mongoose";
import type {
  BaseUserInput,
  DriverInput,
  StudentInput,
} from "@/utils/types/user";

type SnapshotFields = Pick<
  BaseUserInput,
  "firstName" | "lastName" | "email"
> & { _id: mongoose.Types.ObjectId };

export type IStudentSnapshot = SnapshotFields &
  Pick<StudentInput, "type" | "studentInfo">;
export type IDriverSnapshot = SnapshotFields & Pick<DriverInput, "type">;

type SnapshotSource = SnapshotFields & {
  type: string;
  studentInfo?: StudentInput["studentInfo"];
};

const snapshotFields = {
  // The original user's ID is required. A generated subdocument ID would
  // disconnect this snapshot from the user used for authorization.
  _id: { type: Schema.Types.ObjectId, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
};

// These schemas describe historical display snapshots embedded in routes and
// chatlogs. They deliberately omit login-only fields and user collection
// indexes, which belong only to UserModel documents.
export const DriverSnapshotSchema = new Schema<IDriverSnapshot>(
  {
    ...snapshotFields,
    type: { type: String, required: true, enum: ["Driver"] },
  },
  { versionKey: false, excludeIndexes: true },
);

export const StudentSnapshotSchema = new Schema<IStudentSnapshot>(
  {
    ...snapshotFields,
    type: { type: String, required: true, enum: ["Student"] },
    studentInfo: {
      notes: { type: String },
      accessibilityNeeds: [{ type: String }],
    },
  },
  { versionKey: false, excludeIndexes: true },
);

const snapshotFieldsFromUser = (user: SnapshotSource): SnapshotFields => ({
  _id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
});

export function createStudentSnapshot(user: SnapshotSource): IStudentSnapshot {
  if (user.type !== "Student") throw new Error("Expected a student user");
  return {
    ...snapshotFieldsFromUser(user),
    type: "Student",
    studentInfo: {
      notes: user.studentInfo?.notes,
      accessibilityNeeds: user.studentInfo?.accessibilityNeeds
        ? [...user.studentInfo.accessibilityNeeds]
        : undefined,
    },
  };
}

export function createDriverSnapshot(user: SnapshotSource): IDriverSnapshot {
  if (user.type !== "Driver") throw new Error("Expected a driver user");
  return { ...snapshotFieldsFromUser(user), type: "Driver" };
}
