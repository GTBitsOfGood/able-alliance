import connectMongoDB from "../mongodb";
import LocationModel, { ILocation } from "../models/LocationModel";
import { LocationAlreadyExistsException } from "@/utils/exceptions/location";

export async function createLocation(data: ILocation) {
  await connectMongoDB();

  const existing = await LocationModel.findOne({ name: data.name });
  if (existing) {
    throw new LocationAlreadyExistsException();
  }

  const location = await LocationModel.create(data);
  return location.toObject();
}

export async function getLocations() {
  await connectMongoDB();
  const locations = await LocationModel.find().lean();
  return locations;
}
