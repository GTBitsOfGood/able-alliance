import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { SignJWT } from "jose";

// NextAuth reads NEXTAUTH_URL for redirects/URLs; use DEPLOY_PRIME_URL as single source of truth.
if (process.env.DEPLOY_PRIME_URL) {
  process.env.NEXTAUTH_URL = process.env.DEPLOY_PRIME_URL;
}

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET environment variable is required");
}

export const authConfig: NextAuthConfig = {
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
    async jwt({ token, user }) {
      // On initial sign-in, `user` is populated with data we set in the CAS callback
      if (user) {
        token.userId = user.userId;
        token.type = user.type;
        token.email = user.email;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }
      // Generate accessToken for websocket auth if not already set
      if (!token.accessToken && token.userId) {
        const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
        token.accessToken = await new SignJWT({
          userId: token.userId,
          type: token.type,
          email: token.email,
          firstName: token.firstName,
          lastName: token.lastName,
        })
          .setProtectedHeader({ alg: "HS256" })
          .sign(secret);
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as string;
        session.user.type = token.type as string;
        session.user.email = token.email as string;
        session.user.firstName = token.firstName as string;
        session.user.lastName = token.lastName as string;
        session.user.accessToken = token.accessToken as string;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
