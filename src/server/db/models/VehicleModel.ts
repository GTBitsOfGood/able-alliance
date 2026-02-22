import mongoose, { Schema } from "mongoose";
import { VehicleInput } from "@/utils/types/vehicle";

export type IVehicle = VehicleInput;

const VehicleSchema: Schema<IVehicle> = new Schema({
  name: { type: String, required: true },
  licensePlate: { type: String, required: true, unique: true },
  description: { type: String },
  accessibility: {
    type: String,
    enum: ["None", "Wheelchair"],
    required: true,
  },
  seatCount: { type: Number, required: true, min: 1 },
});

const VehicleModel =
  (mongoose.models.Vehicle as mongoose.Model<IVehicle>) ??
  mongoose.model("Vehicle", VehicleSchema);

export { VehicleSchema };
export default VehicleModel;
