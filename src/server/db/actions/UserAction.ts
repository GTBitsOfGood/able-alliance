import { db } from "@db";
import { userInclude } from "@/server/db/queries";
import { Prisma, type UserSettings } from "@db/generated/client";
import type { UserType } from "@db/generated/enums";
import { ArgumentError, ConflictError, NotFoundError } from "@/utils/errors";
import { recordAudit } from "@db/audit";

type UserWithDetails = Prisma.UserGetPayload<{ include: typeof userInclude }>;

function userAuditSnapshot(user: UserWithDetails) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    preferredName: user.preferredName,
    username: user.username,
    email: user.email,
    type: user.type,
    status: user.status,
    settings: user.settings,
    studentInfo: user.studentInfo
      ? {
          notes: user.studentInfo.notes,
          accessibilityNeeds: user.studentInfo.accessibilityNeeds.map(
            ({ label }) => label,
          ),
        }
      : null,
    shifts: user.shifts.map(({ dayOfWeek, startTime, endTime }) => ({
      dayOfWeek,
      startTime,
      endTime,
    })),
  };
}

export async function getUsers(type?: UserType) {
  return db.user.findMany({
    where: type ? { type, status: "active" } : { status: "active" },
    include: userInclude,
  });
}

export async function getUserById(id: string) {
  const user = await db.user.findUnique({
    where: { id: id.toLowerCase() },
    include: userInclude,
  });
  if (!user) throw new NotFoundError("User not found");
  return user;
}

export const getProvisionedUserFromCAS = (username: string) =>
  db.user.findUnique({ where: { username }, include: userInclude });

export async function createUser(
  data: Prisma.UserCreateInput,
  actorId: string,
) {
  try {
    return await db.$transaction(async (tx) => {
      const created = await tx.user.create({ data, include: userInclude });
      await recordAudit(tx, {
        actorId,
        entityType: "User",
        entityId: created.id,
        action: "Create",
        after: userAuditSnapshot(created),
      });
      return created;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        throw new ConflictError(
          "A user with this username or email already exists",
        );
      if (error.code === "P2025" || error.code === "P2003")
        throw new ArgumentError("Invalid referenced record");
    }
    throw error;
  }
}

export async function archiveUser(id: string, actorId: string) {
  return db.$transaction(async (tx) => {
    const userId = id.toLowerCase();
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE
    `);
    const before = await tx.user.findUnique({
      where: { id: userId },
      include: userInclude,
    });
    if (!before) throw new NotFoundError("User not found");
    const updated = await tx.user.update({
      where: { id: before.id },
      data: { status: "archived" },
      include: userInclude,
    });
    await recordAudit(tx, {
      actorId,
      entityType: "User",
      entityId: updated.id,
      action: "Update",
      before: userAuditSnapshot(before),
      after: userAuditSnapshot(updated),
    });
    return updated;
  });
}

export async function updateUser(
  id: string,
  type: UserType,
  patch: {
    preferredName?: string | null;
    notes?: string | null;
    accessibilityNeeds?: string[] | null;
    shifts?: import("@/utils/types/user").Shift[];
    settings?: Partial<Omit<UserSettings, "userId">>;
  },
  actorId: string,
) {
  const data: Prisma.UserUpdateInput = {};
  if (patch.preferredName !== undefined)
    data.preferredName = patch.preferredName;
  if (patch.settings !== undefined) {
    data.settings = {
      upsert: { create: patch.settings, update: patch.settings },
    };
  }
  if (
    type === "Student" &&
    (patch.notes !== undefined || patch.accessibilityNeeds !== undefined)
  ) {
    const notes = patch.notes === undefined ? {} : { notes: patch.notes };
    const labels =
      patch.accessibilityNeeds === undefined
        ? undefined
        : (patch.accessibilityNeeds ?? []);
    data.studentInfo = {
      upsert: {
        create: {
          ...notes,
          ...(labels
            ? {
                accessibilityNeeds: {
                  connect: labels.map((label) => ({ label })),
                },
              }
            : {}),
        },
        update: {
          ...notes,
          ...(labels
            ? {
                accessibilityNeeds: { set: labels.map((label) => ({ label })) },
              }
            : {}),
        },
      },
    };
  }
  if (type === "Driver" && patch.shifts !== undefined) {
    data.shifts = { deleteMany: {}, create: patch.shifts };
  }
  try {
    return await db.$transaction(async (tx) => {
      const userId = id.toLowerCase();
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "User" WHERE "id" = ${userId}::uuid FOR UPDATE
      `);
      const before = await tx.user.findUnique({
        where: { id: userId, type },
        include: userInclude,
      });
      if (!before) throw new NotFoundError("User not found");
      const updated = await tx.user.update({
        where: { id: before.id, type },
        data,
        include: userInclude,
      });
      await recordAudit(tx, {
        actorId,
        entityType: "User",
        entityId: updated.id,
        action: "Update",
        before: userAuditSnapshot(before),
        after: userAuditSnapshot(updated),
      });
      return updated;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      const user = await db.user.findUnique({
        where: { id: id.toLowerCase(), type },
        select: { id: true },
      });
      if (!user) throw new NotFoundError("User not found");
      throw new ArgumentError("Invalid accommodation");
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    )
      throw new ArgumentError("Invalid accommodation");
    throw error;
  }
}
