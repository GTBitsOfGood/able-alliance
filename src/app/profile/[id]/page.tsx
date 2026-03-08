import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/server/db/actions/UserAction";
import { ProfileView, type ProfileUser } from "../ProfileView";

type UserDocument = {
  _id?: { toString(): string };
  name?: string;
  email?: string;
  type?: ProfileUser["type"];
  studentInfo?: ProfileUser["studentInfo"];
};

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

  const doc = data as UserDocument;
  const user: ProfileUser = {
    id: doc._id?.toString?.() ?? targetId,
    name:
      doc.name ??
      (session.user.name as string | undefined) ??
      (session.user.email as string | undefined) ??
      "User",
    email: doc.email ?? (session.user.email as string),
    type: doc.type ?? (session.user.type as ProfileUser["type"]),
    studentInfo: doc.studentInfo ?? null,
  };

  return <ProfileView user={user} />;
}
