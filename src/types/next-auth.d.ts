import type { DefaultSession, User as DefaultUser } from "next-auth";
import type { User as DatabaseUser } from "@db/generated/browser";

type AuthUserFields = Pick<DatabaseUser, "types" | "email"> &
  Partial<Pick<DatabaseUser, "username" | "firstName" | "lastName">> & {
    userId: DatabaseUser["id"];
    activeType: DatabaseUser["types"][number];
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
  interface JWT extends Partial<AuthUserFields> {
    accessToken?: string;
  }
}
