// Dummy Vehicle Model
import mongoose, { Schema } from "mongoose";
import type { VehicleInput } from "@/utils/types";

export type IVehicle = VehicleInput;

const VehicleSchema = new Schema<IVehicle>(
  {
    name: { type: String, required: true },
    licensePlate: { type: String, required: true, unique: true },
    capacity: { type: Number, required: true },
  },
  { versionKey: false },
);

const VehicleModel =
  (mongoose.models.Vehicle as mongoose.Model<IVehicle>) ??
  mongoose.model("Vehicle", VehicleSchema);

export default VehicleModel;
