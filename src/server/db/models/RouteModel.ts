import mongoose, { Schema } from "mongoose";
import type { RouteInput } from "@/utils/types";
import { BaseUserSchema, IBaseUser, StudentSchema } from "./UserModel";
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
  isActive: boolean;
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
    student: { type: StudentSchema, required: true },
    driver: { type: BaseUserSchema, required: false },
    vehicle: { type: VehicleSchema, required: false },
    scheduledPickupTime: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
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
