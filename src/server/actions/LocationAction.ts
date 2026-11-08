import { db } from "@db";
import { Prisma } from "@db/generated/client";
import type { LocationInput } from "@/schemas/location";
import { ConflictError, NotFoundError } from "@/utils/errors";
import { recordAudit } from "@db/audit";
import { RouteStatus } from "@db/generated/client";

export async function createLocation(data: LocationInput, actorId: string) {
  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.location.create({ data });
      await recordAudit(tx, {
        actorId,
        entityType: "Location",
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
export async function archiveLocation(id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const before = await tx.location.findUnique({
      where: { id: id.toLowerCase() },
    });
    if (!before) throw new NotFoundError("Location not found");
    const activeRide = await tx.route.findFirst({
      where: {
        status: {
          notIn: [
            RouteStatus.Completed,
            RouteStatus.Missing,
            RouteStatus.CancelledByStudent,
            RouteStatus.CancelledByAdmin,
          ],
        },
        OR: [{ pickupLocation: before.id }, { dropoffLocation: before.id }],
      },
      select: { id: true },
    });
    if (activeRide) {
      throw new ConflictError(
        "This location is used by an active ride and cannot be archived.",
      );
    }
    const updated = await tx.location.update({
      where: { id: before.id },
      data: { status: "archived" },
    });
    await recordAudit(tx, {
      actorId,
      entityType: "Location",
      entityId: updated.id,
      action: "Update",
      before,
      after: updated,
    });
    return updated;
  });
}
