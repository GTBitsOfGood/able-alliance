"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import AppNavbar from "@/components/AppNavbar";
import AdminSidebar from "@/components/admin/AdminSidebar";
import RoleSwitcher from "@/components/RoleSwitcher";
import AdminRidesProvider from "@/components/admin/AdminRidesProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  // The login page is outside the authenticated check, including for
  // signed-in users while its redirect is resolving
  if (pathname === "/login") return <>{children}</>;

  const userType = session?.user?.activeType;
  const hasSession = Boolean(session?.user);
  const isAdmin =
    hasSession && (userType === "Admin" || userType === "SuperAdmin");

  // Initial loading has no session. During a session update, keep the existing
  // layout and switcher mounted until navigation to the new role completes.
  if (status === "loading" && !hasSession) {
    return null;
  }

  // A role switch updates the session before the full navigation completes.
  // Admin pages must never render outside their role's provider.
  if (!isAdmin && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    return null;
  }

  if (isAdmin) {
    return (
      <AdminRidesProvider>
        <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
          <AdminSidebar />
          <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
            {children}
          </main>
        </div>
        <RoleSwitcher />
      </AdminRidesProvider>
    );
  }

  return (
    <>
      <AppNavbar />
      {children}
      <RoleSwitcher />
    </>
  );
}
