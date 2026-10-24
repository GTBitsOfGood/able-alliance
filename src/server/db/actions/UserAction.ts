import { db } from "@db";
import { userInclude } from "@/server/db/queries";
import { Prisma, type UserSettings } from "@db/generated/client";
import type { UserType } from "@db/generated/enums";
import { ArgumentError, ConflictError, NotFoundError } from "@/utils/errors";

export async function getUsers(type?: UserType) {
  return db.user.findMany({
    where: type ? { type } : {},
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

export async function createUser(data: Prisma.UserCreateInput) {
  try {
    return await db.user.create({ data, include: userInclude });
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

export async function deleteUser(id: string) {
  try {
    return await db.user.delete({
      where: { id: id.toLowerCase() },
      include: userInclude,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") throw new NotFoundError("User not found");
      if (error.code === "P2003")
        throw new ConflictError(
          "User has ride or message history and cannot be deleted",
        );
    }
    throw error;
  }
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
    return await db.user.update({
      where: { id: id.toLowerCase(), type },
      data,
      include: userInclude,
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
