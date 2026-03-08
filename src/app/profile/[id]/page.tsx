import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/server/db/actions/UserAction";
import { ProfileView, type ProfileUser } from "../ProfileView";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id: targetId } = await params;
  const viewerId = session.user.userId;
  const viewerType = session.user.type;

  const canView =
    viewerId === targetId ||
    viewerType === "Driver" ||
    viewerType === "Admin" ||
    viewerType === "SuperAdmin";

  if (!canView) {
    redirect("/"); // default redirect to home if not allowed
  }

  const data = await getUserById(targetId).catch(() => null);

  if (!data) {
    if (viewerId !== targetId) {
      redirect("/");
    }

    const selfFromSession: ProfileUser = {
      id: targetId,
      name:
        (session.user.name as string | undefined) ??
        (session.user.email as string | undefined) ??
        "User",
      email: session.user.email as string,
      type: session.user.type as ProfileUser["type"],
      studentInfo: null,
    };

    return <ProfileView user={selfFromSession} />;
  }

  const user: ProfileUser = {
    id: (data as any)._id?.toString?.() ?? targetId,
    name:
      ((data as any).name as string | undefined) ??
      (session.user.name as string | undefined) ??
      (session.user.email as string | undefined) ??
      "User",
    email:
      ((data as any).email as string | undefined) ??
      (session.user.email as string),
    type:
      ((data as any).type as ProfileUser["type"] | undefined) ??
      (session.user.type as ProfileUser["type"]),
    studentInfo: (data as any).studentInfo ?? null,
  };

  return <ProfileView user={user} />;
}
