import connectMongoDB from "../mongodb";
import VehicleModel, { IVehicle } from "../models/VehicleModel";
import { VehicleAlreadyExistsException } from "@/utils/exceptions/vehicle";

export async function createVehicle(data: IVehicle) {
  await connectMongoDB();

  const existing = await VehicleModel.findOne({
    licensePlate: data.licensePlate,
  });
  if (existing) {
    throw new VehicleAlreadyExistsException();
  }

  const vehicle = await VehicleModel.create(data);
  return vehicle.toObject();
}

export async function getVehicles() {
  await connectMongoDB();
  const vehicles = await VehicleModel.find().lean();
  return vehicles;
}

export async function getVehicleById(id: string) {
  await connectMongoDB();
  const vehicle = await VehicleModel.findById(id).lean();
  return vehicle;
}

export async function deleteVehicleById(id: string) {
  await connectMongoDB();
  const deleted = await VehicleModel.findByIdAndDelete(id);
  return deleted;
}
