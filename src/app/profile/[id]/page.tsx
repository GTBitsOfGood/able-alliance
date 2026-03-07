import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/server/db/actions/UserAction";
import { ProfileView, type ProfileUser } from "../ProfileView";

export default async function ProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const viewerId = session.user.userId;
  const viewerType = session.user.type;
  const targetId = params.id;

  const canView =
    viewerId === targetId ||
    viewerType === "Driver" ||
    viewerType === "Admin" ||
    viewerType === "SuperAdmin";

  if (!canView) {
    redirect("/"); // default redirect to home if not allowed
  }

  const data = await getUserById(targetId).catch(() => null);

  const baseFromSession: ProfileUser = {
    id: viewerId,
    //default split for first and last name. TODO on split/db fields
    name:
      (session.user.name as string | undefined) ??
      (session.user.email as string | undefined) ??
      "User",
    email: session.user.email as string,
    type: session.user.type as ProfileUser["type"],
    studentInfo: null,
  };

  const user: ProfileUser = data
    ? {
        id: (data as any)._id?.toString?.() ?? baseFromSession.id,
        name: ((data as any).name as string) ?? baseFromSession.name,
        email: ((data as any).email as string) ?? baseFromSession.email,
        type:
          ((data as any).type as ProfileUser["type"]) ?? baseFromSession.type,
        studentInfo: (data as any).studentInfo ?? baseFromSession.studentInfo,
      }
    : baseFromSession;

  return <ProfileView user={user} />;
}

