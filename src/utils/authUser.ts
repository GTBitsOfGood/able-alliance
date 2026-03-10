import { auth } from "../auth";

export type UserType = "Student" | "Driver" | "Admin" | "SuperAdmin";

export interface AuthUser {
  userId: string;
  type: UserType;
}

export async function getUserFromRequest(): Promise<AuthUser> {
  const session = await auth();
  if (!session || !session.user || !session.user.userId || !session.user.type) {
    throw new Error("Invalid session or missing user info");
  }
  return {
    userId: session.user.userId,
    type: session.user.type as UserType,
  };
}
