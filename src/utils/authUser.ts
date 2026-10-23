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
  return {
    userId: session.user.userId,
    type: session.user.type,
  };
}
