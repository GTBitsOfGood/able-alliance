import type { DefaultSession, User as DefaultUser } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      type: string;
      email: string;
      gtid: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    userId: string;
    type: string;
    email: string;
    gtid: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    userId?: string;
    type?: string;
    email?: string;
    gtid?: string;
  }
}
