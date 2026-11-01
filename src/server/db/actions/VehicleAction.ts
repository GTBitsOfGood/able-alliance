import { db } from "@db";
import { Prisma } from "@db/generated/client";
import type { VehicleInput } from "@/utils/types/vehicle";
import { ConflictError, NotFoundError } from "@/utils/errors";
import { recordAudit } from "@db/audit";

export async function createVehicle(data: VehicleInput, actorId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.vehicle.create({ data });
      await recordAudit(tx, {
        actorId,
        entityType: "Vehicle",
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
export async function archiveVehicle(id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.vehicle.findUnique({
      where: { id: id.toLowerCase() },
    });
    if (!before) throw new NotFoundError("Vehicle not found");
    const updated = await tx.vehicle.update({
      where: { id: before.id },
      data: { status: "archived" },
    });
    await recordAudit(tx, {
      actorId,
      entityType: "Vehicle",
      entityId: updated.id,
      action: "Update",
      before,
      after: updated,
    });
    return updated;
  });
}
export async function updateVehicle(
  id: string,
  data: Partial<VehicleInput>,
  actorId: string,
) {
  try {
    return await db.$transaction(async (tx) => {
      const before = await tx.vehicle.findUnique({
        where: { id: id.toLowerCase() },
      });
      if (!before) throw new NotFoundError("Vehicle not found");
      const updated = await tx.vehicle.update({
        where: { id: before.id },
        data,
      });
      await recordAudit(tx, {
        actorId,
        entityType: "Vehicle",
        entityId: updated.id,
        action: "Update",
        before,
        after: updated,
      });
      return updated;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") throw new NotFoundError("Vehicle not found");
      if (error.code === "P2002")
        throw new ConflictError("Vehicle ID or license plate already exists");
    }
    throw error;
  }
}
