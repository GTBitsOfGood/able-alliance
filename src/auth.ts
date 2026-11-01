import NextAuth from "next-auth";
import { db } from "@db";
import type { NextAuthConfig } from "next-auth";
import { decodeJwt, SignJWT } from "jose";
import type { UserType } from "@db/generated/browser";
import { UserType as UserTypeEnum } from "@db/generated/enums";
import { z } from "zod";

const sessionUpdateSchema = z
  .object({ activeType: z.enum(UserTypeEnum) })
  .strict();

function accessTokenNeedsRefresh(accessToken: string | undefined): boolean {
  if (!accessToken) return true;
  try {
    const { exp } = decodeJwt(accessToken);
    return !exp || exp <= Date.now() / 1000 + 5 * 60;
  } catch {
    return true;
  }
}

// NextAuth reads NEXTAUTH_URL for redirects/URLs; use DEPLOY_PRIME_URL as single source of truth.
if (process.env.DEPLOY_PRIME_URL) {
  process.env.NEXTAUTH_URL = process.env.DEPLOY_PRIME_URL;
}

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET environment variable is required");
}

// Keep the custom CAS routes and Auth.js on the same cookie settings.
const secureCookies =
  process.env.DEPLOY_PRIME_URL?.startsWith("https://") ?? false;

export const authConfig = {
  useSecureCookies: secureCookies,
  cookies: {
    sessionToken: {
      name: `${secureCookies ? "__Secure-" : ""}authjs.session-token`,
      options: {
        httpOnly: true,
        secure: secureCookies,
        sameSite: "lax",
        path: "/",
      },
    },
  },
  secret: process.env.NEXTAUTH_SECRET,

  // We don't use built-in providers — CAS is handled via custom route handlers
  providers: [],

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },

  pages: {
    signIn: "/login",
  },

  callbacks: {
    async jwt({ token, user, trigger, session }) {
      const userId = user?.userId ?? token.userId;
      if (!userId) return null;

      const account = await db.user.findUnique({ where: { id: userId } });
      if (!account || account.status !== "active") return null;

      const types = account.types;
      if (!types.length) return null;

      const previousType = token.activeType;
      let requestedType = user?.activeType ?? token.activeType;
      if (trigger === "update") {
        const update = sessionUpdateSchema.safeParse(session);
        if (update.success && types.includes(update.data.activeType)) {
          requestedType = update.data.activeType;
        }
      }

      token.userId = account.id;
      token.activeType =
        requestedType && types.includes(requestedType)
          ? requestedType
          : types[0];
      token.types = types;
      token.username = account.username;
      token.email = account.email;
      token.firstName = account.firstName;
      token.lastName = account.lastName;
      token.name =
        account.preferredName || `${account.firstName} ${account.lastName}`;

      // Identity and assigned types always come from the database, never client updates.
      if (
        accessTokenNeedsRefresh(token.accessToken) ||
        previousType !== token.activeType
      ) {
        const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
        token.accessToken = await new SignJWT({
          userId: token.userId,
          activeType: token.activeType,
          username: token.username,
          email: token.email,
          firstName: token.firstName,
          lastName: token.lastName,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setExpirationTime("24h")
          .sign(secret);
      }

      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as string;
        session.user.activeType = token.activeType as UserType;
        session.user.types = token.types ?? [session.user.activeType];
        session.user.username = token.username as string;
        session.user.email = token.email as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
