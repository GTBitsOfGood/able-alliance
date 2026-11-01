import { db } from "@db";
import { Prisma } from "@db/generated/client";
import type { VehicleInput } from "@/utils/types/vehicle";
import { ConflictError, NotFoundError } from "@/utils/errors";
export async function createVehicle(data: VehicleInput) {
  try {
    return await db.vehicle.create({ data });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictError("Vehicle ID or license plate already exists");
    throw error;
  }
}
export const getVehicles = () =>
  db.vehicle.findMany({ where: { status: "active" } });
export async function getVehicleById(id: string) {
  const vehicle = await db.vehicle.findUnique({
    where: { id: id.toLowerCase() },
  });
  if (!vehicle) throw new NotFoundError("Vehicle not found");
  return vehicle;
}
export async function archiveVehicle(id: string) {
  await getVehicleById(id);
  return db.vehicle.update({
    where: { id: id.toLowerCase() },
    data: { status: "archived" },
  });
}
export async function updateVehicle(id: string, data: Partial<VehicleInput>) {
  try {
    return await db.vehicle.update({ where: { id: id.toLowerCase() }, data });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") throw new NotFoundError("Vehicle not found");
      if (error.code === "P2002")
        throw new ConflictError("Vehicle ID or license plate already exists");
    }
    throw error;
  }
}
