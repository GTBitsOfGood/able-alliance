"use client";

import { SessionProvider } from "next-auth/react";
import NotificationProvider from "@/components/NotificationProvider/NotificationProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={5 * 60}>
      <NotificationProvider>{children}</NotificationProvider>
    </SessionProvider>
  );
}
