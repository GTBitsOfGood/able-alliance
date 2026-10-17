import mongoose, { Schema } from "mongoose";

export interface IJobLock {
  _id: string;
  lockedUntil: Date;
  lockedAt: Date;
  /** Identifies the run holding the lease, so only that run can release it. */
  token?: string;
}

/**
 * A single-document mutex per job name, used to keep concurrent or overlapping
 * runs of a scheduled job from doing the same work twice.
 *
 * `lockedUntil` is a lease rather than a plain flag: a process that crashes mid-run
 * would otherwise hold the lock forever, so the lock is considered free once its
 * lease has expired.
 */
const JobLockSchema = new Schema<IJobLock>(
  {
    _id: { type: String, required: true },
    lockedUntil: { type: Date, required: true },
    lockedAt: { type: Date, required: true },
    token: { type: String, required: false },
  },
  { versionKey: false, _id: false },
);

const JobLockModel =
  (mongoose.models.JobLock as mongoose.Model<IJobLock>) ??
  mongoose.model<IJobLock>("JobLock", JobLockSchema);

export default JobLockModel;
