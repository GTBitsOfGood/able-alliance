import mongoose, { Schema } from "mongoose";

export interface IAccommodation {
  label: string;
}

const AccommodationSchema = new Schema<IAccommodation>(
  {
    label: { type: String, required: true, unique: true },
  },
  { versionKey: false },
);

const AccommodationModel =
  (mongoose.models.Accommodation as mongoose.Model<IAccommodation>) ??
  mongoose.model<IAccommodation>("Accommodation", AccommodationSchema);

export default AccommodationModel;
