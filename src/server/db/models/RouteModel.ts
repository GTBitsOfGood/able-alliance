import mongoose, { Schema } from "mongoose";
import type { RouteInput } from "@/utils/types";

export type IRoute = RouteInput;

/** Document type for schema (refs as ObjectId); create() accepts RouteInput (string refs). */
interface IRouteDocument {
  pickupLocation: mongoose.Types.ObjectId;
  dropoffLocation: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  driver?: mongoose.Types.ObjectId;
  vehicle?: mongoose.Types.ObjectId;
  scheduledPickupTime: Date;
  isActive: boolean;
  status: "Standby" | "En-route";
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
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    driver: { type: Schema.Types.ObjectId, ref: "User", required: false },
    vehicle: { type: Schema.Types.ObjectId, ref: "Vehicle", required: false },
    scheduledPickupTime: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
    status: { type: String, enum: ["Standby", "En-route"] },
  },
  { versionKey: false },
);

const RouteModel =
  (mongoose.models.Route as mongoose.Model<IRouteDocument>) ??
  mongoose.model<IRouteDocument>("Route", RouteSchema);

export default RouteModel;
