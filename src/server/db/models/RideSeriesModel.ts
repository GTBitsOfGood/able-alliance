import mongoose, { Schema } from "mongoose";
import type { RecurrenceFrequency } from "@/utils/types/rideSeries";

/**
 * Document shape. Declared separately from the zod input type because refs are
 * ObjectIds here and 24-char hex strings over the wire — the same split
 * RouteModel uses.
 */
export interface IRideSeries {
  student: mongoose.Types.ObjectId;
  pickupLocation: mongoose.Types.ObjectId;
  dropoffLocation: mongoose.Types.ObjectId;
  frequency: RecurrenceFrequency;
  firstPickupTime: Date;
  pickupWindowStartOffsetMs: number;
  pickupWindowEndOffsetMs: number;
  materializedThrough: Date;
  active: boolean;
}

/**
 * A recurring ride template. Individual rides are materialized from this by the
 * scheduled job in RideSeriesAction; the series itself never holds the rides.
 *
 * Decoupling the two is what lets a student edit or cancel one ride without the
 * series fighting back: the job only ever looks forward from `materializedThrough`,
 * so an occurrence that has already been generated is never revisited.
 */
const RideSeriesSchema = new Schema<IRideSeries>(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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
    frequency: {
      type: String,
      enum: ["weekly"],
      default: "weekly",
      required: true,
    },
    firstPickupTime: { type: Date, required: true },
    pickupWindowStartOffsetMs: { type: Number, required: true },
    pickupWindowEndOffsetMs: { type: Number, required: true },
    materializedThrough: { type: Date, required: true },
    active: { type: Boolean, default: true, required: true },
  },
  { versionKey: false, timestamps: true },
);

// The job scans for active series whose horizon needs extending.
RideSeriesSchema.index({ active: 1, materializedThrough: 1 });
RideSeriesSchema.index({ student: 1 });

const RideSeriesModel =
  (mongoose.models.RideSeries as mongoose.Model<IRideSeries>) ??
  mongoose.model<IRideSeries>("RideSeries", RideSeriesSchema);

export default RideSeriesModel;
