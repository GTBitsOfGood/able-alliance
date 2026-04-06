import connectMongoDB from "../mongodb";
import AccommodationModel, {
  IAccommodation,
} from "../models/AccommodationModel";

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
  return deleted;
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
