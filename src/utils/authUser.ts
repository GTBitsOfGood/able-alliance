import { db } from "@db";
import { hasUserType } from "./userTypes";
import { auth } from "../auth";

import type { User } from "@db/generated/browser";
export type { UserType } from "@db/generated/browser";

export type AuthUser = Pick<User, "types"> & {
  activeType: User["types"][number];
} & { userId: User["id"] };

export { isAdmin } from "./userTypes";

export async function getUserFromRequest(): Promise<AuthUser> {
  const session = await auth();
  if (
    !session ||
    !session.user ||
    !session.user.userId ||
    !session.user.activeType
  ) {
    throw new Error("Invalid session or missing user info");
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.userId },
    select: { status: true, types: true },
  });
  if (!dbUser || dbUser.status === "archived") {
    throw new Error("Account is archived or no longer exists");
  }
  if (!hasUserType(dbUser, session.user.activeType)) {
    throw new Error("Active role is no longer assigned");
  }
  return {
    userId: session.user.userId,
    activeType: session.user.activeType,
    types: dbUser.types,
  };
}
