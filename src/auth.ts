import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
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
    jwt({ token, user }) {
      // On initial sign-in, `user` is populated with data we set in the CAS callback
      if (user) {
        token.userId = user.userId;
        token.type = user.type;
        token.email = user.email;
        token.gtid = user.gtid;
      }
      return token;
    },

    session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as string;
        session.user.type = token.type as string;
        session.user.email = token.email as string;
        session.user.gtid = token.gtid as string;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
