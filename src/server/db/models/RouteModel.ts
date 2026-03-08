import mongoose, { Schema } from "mongoose";
import type { RouteInput } from "@/utils/types";
import type { IBaseUser } from "./UserModel";
import { IVehicle, VehicleSchema } from "./VehicleModel";

export type IRoute = RouteInput;

export enum RouteStatus {
  Requested = "Requested",
  Scheduled = "Scheduled",
  EnRoute = "En-route",
  Pickedup = "Pickedup",
  Completed = "Completed",
  Missing = "Missing",
  CancelledByDriver = "Cancelled by Driver",
  CancelledByStudent = "Cancelled by Student",
  CancelledByAdmin = "Cancelled by Admin",
}

interface IRouteDocument {
  pickupLocation: mongoose.Types.ObjectId;
  dropoffLocation: mongoose.Types.ObjectId;
  student: IBaseUser;
  driver?: IBaseUser;
  vehicle?: IVehicle;
  scheduledPickupTime: Date;
  status: RouteStatus;
}

// Embedded user/student schemas WITHOUT unique indexes (same structure as UserModel
// but for subdocuments; unique on email only makes sense in the users collection).
const EmbeddedBaseUserSchema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["Student", "Driver", "Admin", "SuperAdmin"],
    },
  },
  { _id: true, versionKey: false },
);

const EmbeddedStudentSchema = new Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    type: { type: String, required: true, enum: ["Student"] },
    studentInfo: {
      notes: { type: String },
      accessibilityNeeds: { type: String, enum: ["Wheelchair", "LowMobility"] },
    },
  },
  { _id: true, versionKey: false },
);

const RouteSchema = new Schema<IRouteDocument>(
  {
    pickupLocation: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    dropoffLocation: {
      type: Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    student: { type: EmbeddedStudentSchema, required: true },
    driver: { type: EmbeddedBaseUserSchema, required: false },
    vehicle: { type: VehicleSchema, required: false },
    scheduledPickupTime: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(RouteStatus),
      default: RouteStatus.Requested,
      required: true,
    },
  },
  { versionKey: false },
);

const RouteModel =
  (mongoose.models.Route as mongoose.Model<IRouteDocument>) ??
  mongoose.model<IRouteDocument>("Route", RouteSchema);

export default RouteModel;
