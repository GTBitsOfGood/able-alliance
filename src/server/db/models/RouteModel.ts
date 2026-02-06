import mongoose, { Schema } from "mongoose";
import type { RouteInput } from "@/utils/types";

export type IRoute = RouteInput;

const RouteSchema = new Schema<IRoute>(
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
    driver: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vehicle: { type: Schema.Types.ObjectId, ref: "Vehicle", required: true },
    scheduledPickupTime: { type: Date, required: true },
    isActive: { type: Boolean, default: false },
  },
  { versionKey: false },
);

const RouteModel =
  (mongoose.models.Route as mongoose.Model<IRoute>) ??
  mongoose.model("Route", RouteSchema);

export default RouteModel;
