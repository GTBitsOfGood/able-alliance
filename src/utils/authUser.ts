import { db } from "@db";
import { auth } from "../auth";

import type { User } from "@db/generated/browser";
export type { UserType } from "@db/generated/browser";

export type AuthUser = Pick<User, "type"> & { userId: User["id"] };

export function isAdmin(type: string | null | undefined): boolean {
  return type === "Admin" || type === "SuperAdmin";
}

export async function getUserFromRequest(): Promise<AuthUser> {
  const session = await auth();
  if (!session || !session.user || !session.user.userId || !session.user.type) {
    throw new Error("Invalid session or missing user info");
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.userId },
    select: { status: true },
  });
  if (!dbUser || dbUser.status === "archived") {
    throw new Error("Account is archived or no longer exists");
  }
  return {
    userId: session.user.userId,
    type: session.user.type,
  };
}
