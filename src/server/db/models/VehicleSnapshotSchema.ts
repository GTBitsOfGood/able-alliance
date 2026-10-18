import { Schema } from "mongoose";

// Vehicle details recorded for a ride. Unique vehicleId/licensePlate indexes
// belong to the vehicles collection, not to snapshots embedded in routes.
export const VehicleSnapshotSchema = new Schema(
  {
    vehicleId: { type: String },
    name: { type: String, required: true },
    licensePlate: { type: String, required: true },
    description: { type: String },
    accessibility: {
      type: String,
      enum: ["None", "Wheelchair"],
      required: true,
    },
    seatCount: { type: Number, required: true, min: 1 },
  },
  { _id: true, versionKey: false, excludeIndexes: true },
);
