import connectMongoDB from "../mongodb";
import AccommodationModel, {
  IAccommodation,
} from "../models/AccommodationModel";
import { StudentModel } from "../models/UserModel";
import RouteModel from "../models/RouteModel";

export async function getAccommodations(): Promise<
  (IAccommodation & { _id: string })[]
> {
  await connectMongoDB();
  const docs = await AccommodationModel.find().lean();
  return docs.map((d) => ({ ...d, _id: d._id.toString() }));
}

export async function createAccommodation(label: string) {
  await connectMongoDB();
  const existing = await AccommodationModel.findOne({ label });
  if (existing) {
    throw new Error(`Accommodation "${label}" already exists`);
  }
  const doc = await AccommodationModel.create({ label });
  return { ...doc.toObject(), _id: doc._id.toString() };
}

export async function deleteAccommodation(id: string) {
  await connectMongoDB();
  const deleted = await AccommodationModel.findByIdAndDelete(id).lean();
  if (deleted) {
    // Remove this accommodation from all user profiles and embedded route student data
    await Promise.all([
      StudentModel.updateMany(
        { "studentInfo.accessibilityNeeds": deleted.label },
        { $pull: { "studentInfo.accessibilityNeeds": deleted.label } },
      ),
      RouteModel.updateMany(
        { "student.studentInfo.accessibilityNeeds": deleted.label },
        { $pull: { "student.studentInfo.accessibilityNeeds": deleted.label } },
      ),
    ]);
  }
  return deleted;
}

export async function renameAccommodation(id: string, newLabel: string) {
  await connectMongoDB();
  const existing = await AccommodationModel.findOne({ label: newLabel });
  if (existing && existing._id.toString() !== id) {
    throw new Error(`Accommodation "${newLabel}" already exists`);
  }
  const doc = await AccommodationModel.findById(id).lean();
  if (!doc) return null;
  const oldLabel = doc.label;
  const updated = await AccommodationModel.findByIdAndUpdate(
    id,
    { label: newLabel },
    { new: true },
  ).lean();
  if (updated && oldLabel !== newLabel) {
    // Update all user profiles and embedded route student data that had the old label
    await Promise.all([
      StudentModel.updateMany(
        { "studentInfo.accessibilityNeeds": oldLabel },
        { $set: { "studentInfo.accessibilityNeeds.$": newLabel } },
      ),
      RouteModel.updateMany(
        { "student.studentInfo.accessibilityNeeds": oldLabel },
        { $set: { "student.studentInfo.accessibilityNeeds.$": newLabel } },
      ),
    ]);
  }
  return updated ? { ...updated, _id: updated._id.toString() } : null;
}

/** Returns the labels of any provided strings that don't exist in the collection. */
export async function findInvalidAccommodations(
  labels: string[],
): Promise<string[]> {
  await connectMongoDB();
  if (labels.length === 0) return [];
  const found = await AccommodationModel.find({
    label: { $in: labels },
  }).lean();
  const foundLabels = new Set(found.map((d) => d.label));
  return labels.filter((l) => !foundLabels.has(l));
}
