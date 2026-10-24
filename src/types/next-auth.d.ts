import type { DefaultSession, User as DefaultUser } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";
import type { User as DatabaseUser } from "@db/generated/browser";

type AuthUserFields = Pick<DatabaseUser, "type" | "email"> &
  Partial<Pick<DatabaseUser, "username" | "firstName" | "lastName">> & {
    userId: DatabaseUser["id"];
  };

declare module "next-auth" {
  interface Session {
    user: AuthUserFields & {
      accessToken: string;
    } & DefaultSession["user"];
  }

  interface User
    extends Omit<DefaultUser, keyof AuthUserFields>, AuthUserFields {}
}

declare module "next-auth/jwt" {
  interface JWT
    extends Omit<DefaultJWT, keyof AuthUserFields>, Partial<AuthUserFields> {
    accessToken?: string;
  }
}
