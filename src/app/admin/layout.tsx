import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getUserFromRequest().catch(() => null);
  if (!user) redirect("/login");
  if (!isAdmin(user.activeType)) redirect("/");

  return children;
}
