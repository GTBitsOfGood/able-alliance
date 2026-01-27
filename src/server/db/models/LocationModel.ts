import mongoose, { Schema } from "mongoose";
import type { LocationInput } from "@/utils/types";

export type ILocation = LocationInput;

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, unique: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
  },
  { versionKey: false },
);

const LocationModel =
  (mongoose.models.Location as mongoose.Model<ILocation>) ??
  mongoose.model("Location", LocationSchema);

export default LocationModel;
