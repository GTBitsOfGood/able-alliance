import mongoose, { Schema } from "mongoose";

export interface ISchedulingLock {
  _id: string;
  owner: string;
  expiresAt: Date;
}

const SchedulingLockSchema: Schema<ISchedulingLock> = new Schema(
  {
    _id: { type: String, required: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { versionKey: false },
);

const SchedulingLockModel =
  (mongoose.models.SchedulingLock as mongoose.Model<ISchedulingLock>) ??
  mongoose.model("SchedulingLock", SchedulingLockSchema);

export default SchedulingLockModel;
