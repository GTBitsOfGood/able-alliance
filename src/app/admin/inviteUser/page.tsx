import { redirect } from "next/navigation";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import InviteUserForm from "./InviteUserForm";

export default async function InviteUserPage() {
  const user = await getUserFromRequest().catch(() => null);
  if (!user) redirect("/login");
  if (!isAdmin(user.activeType)) redirect("/");
  return <InviteUserForm canInviteAdmins={user.activeType === "SuperAdmin"} />;
}
