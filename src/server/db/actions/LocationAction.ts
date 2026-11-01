import { db } from "@db";
import { Prisma } from "@db/generated/client";
import type { LocationInput } from "@/utils/types";
import { ConflictError, NotFoundError } from "@/utils/errors";
export async function createLocation(data: LocationInput) {
  try {
    return await db.location.create({ data });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictError("Location already exists");
    throw error;
  }
}
export const getLocations = () =>
  db.location.findMany({ where: { status: "active" } });
export async function getLocationById(id: string) {
  const location = await db.location.findUnique({
    where: { id: id.toLowerCase() },
  });
  if (!location) throw new NotFoundError("Location not found");
  return location;
}
export async function archiveLocation(id: string) {
  await getLocationById(id);
  return db.location.update({
    where: { id: id.toLowerCase() },
    data: { status: "archived" },
  });
}
