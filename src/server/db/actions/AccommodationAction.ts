import { db } from "@db";
import { Prisma } from "@db/generated/client";
import { ConflictError, NotFoundError } from "@/utils/errors";
import { recordAudit } from "@db/audit";

export const getAccommodations = () => db.accommodation.findMany();

export async function createAccommodation(label: string, actorId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.accommodation.create({ data: { label } });
      await recordAudit(tx, {
        actorId,
        entityType: "Accommodation",
        entityId: created.id,
        action: "Create",
        after: created,
      });
      return created;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ConflictError("Accommodation already exists");
    throw error;
  }
}

export async function deleteAccommodation(id: string, actorId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const removed = await tx.accommodation.delete({
        where: { id: id.toLowerCase() },
      });
      await recordAudit(tx, {
        actorId,
        entityType: "Accommodation",
        entityId: removed.id,
        action: "Delete",
        before: removed,
      });
      return removed;
    });
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

export async function renameAccommodation(
  id: string,
  label: string,
  actorId: string,
) {
  try {
    return await db.$transaction(async (tx) => {
      const accommodationId = id.toLowerCase();
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "Accommodation"
        WHERE "id" = ${accommodationId}::uuid
        FOR UPDATE
      `);
      const before = await tx.accommodation.findUnique({
        where: { id: accommodationId },
      });
      if (!before) throw new NotFoundError("Accommodation not found");
      const updated = await tx.accommodation.update({
        where: { id: before.id },
        data: { label },
      });
      await recordAudit(tx, {
        actorId,
        entityType: "Accommodation",
        entityId: updated.id,
        action: "Update",
        before,
        after: updated,
      });
      return updated;
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
