import { db } from "@db";
import { Prisma } from "@db/generated/client";
import { ConflictError, NotFoundError } from "@/utils/errors";

export const getAccommodations = () => db.accommodation.findMany();

export async function createAccommodation(label: string) {
  try {
    return await db.accommodation.create({ data: { label } });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictError("Accommodation already exists");
    throw error;
  }
}

export async function deleteAccommodation(id: string) {
  try {
    return await db.accommodation.delete({ where: { id: id.toLowerCase() } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025")
        throw new NotFoundError("Accommodation not found");
      if (error.code === "P2003")
        throw new ConflictError("Accommodation is still in use");
    }
    throw error;
  }
}

export async function renameAccommodation(id: string, label: string) {
  try {
    return await db.accommodation.update({
      where: { id: id.toLowerCase() },
      data: { label },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025")
        throw new NotFoundError("Accommodation not found");
      if (error.code === "P2002")
        throw new ConflictError("Accommodation already exists");
    }
    throw error;
  }
}

export async function findInvalidAccommodations(labels: string[]) {
  const found = new Set(
    (
      await db.accommodation.findMany({
        where: { label: { in: labels } },
        select: { label: true },
      })
    ).map((x) => x.label),
  );
  return labels.filter((x) => !found.has(x));
}
