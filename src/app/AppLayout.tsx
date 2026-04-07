"use client";

import { useSession } from "next-auth/react";
import AppNavbar from "@/components/AppNavbar";
import AdminSidebar from "@/components/AdminSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const userType = session?.user?.type;
  const isAdmin =
    status === "authenticated" &&
    (userType === "Admin" || userType === "SuperAdmin");

  // During loading, don't render navbar (it returns null anyway) but keep
  // children visible so the page doesn't blank out
  if (status === "loading") {
    return <>{children}</>;
  }

  if (isAdmin) {
    return (
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <AdminSidebar />
        <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
          {children}
        </main>
      </div>
    );
  }

  return (
    <>
      <AppNavbar />
      {children}
    </>
  );
}
