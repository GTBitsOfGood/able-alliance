import mongoose, { Schema } from "mongoose";
import type { RouteInput } from "@/utils/types";
import type { IVehicle } from "./VehicleModel";
import { VehicleSnapshotSchema } from "./VehicleSnapshotSchema";
import {
  StudentSnapshotSchema,
  DriverSnapshotSchema,
  type IStudentSnapshot,
  type IDriverSnapshot,
} from "./UserSnapshotSchema";

export type IRoute = RouteInput;

export enum RouteStatus {
  Requested = "Requested",
  Scheduled = "Scheduled",
  EnRoute = "En-route",
  Pickedup = "Pickedup",
  Completed = "Completed",
  Missing = "Missing",
  CancelledByStudent = "Cancelled by Student",
  CancelledByAdmin = "Cancelled by Admin",
}
interface IRouteDocument {
  pickupLocation: mongoose.Types.ObjectId;
  dropoffLocation: mongoose.Types.ObjectId;
  student: IStudentSnapshot;
  driver?: IDriverSnapshot;
  vehicle?: IVehicle;
  scheduledPickupTime: Date;
  pickupWindowStart: Date;
  pickupWindowEnd: Date;
  estimatedDropoffTime?: Date;
  status: RouteStatus;
}

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
    student: { type: StudentSnapshotSchema, required: true },
    driver: { type: DriverSnapshotSchema, required: false },
    vehicle: { type: VehicleSnapshotSchema, required: false },
    scheduledPickupTime: { type: Date, required: true },
    pickupWindowStart: { type: Date, required: true },
    pickupWindowEnd: { type: Date, required: true },
    estimatedDropoffTime: { type: Date, required: false },
    status: {
      type: String,
      enum: Object.values(RouteStatus),
      default: RouteStatus.Requested,
      required: true,
    },
  },
  { versionKey: false },
);

RouteSchema.index({ scheduledPickupTime: 1 });
RouteSchema.index({ status: 1 });
RouteSchema.index({ "student._id": 1 });
RouteSchema.index({ "driver._id": 1 });
RouteSchema.index({ "vehicle._id": 1 });

const RouteModel =
  (mongoose.models.Route as mongoose.Model<IRouteDocument>) ??
  mongoose.model<IRouteDocument>("Route", RouteSchema);

export default RouteModel;
