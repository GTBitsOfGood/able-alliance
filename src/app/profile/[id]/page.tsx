import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/server/db/actions/UserAction";
import { ProfileView, type ProfileUser } from "../ProfileView";
import type { UserType } from "@/utils/authUser";

type UserDocument = {
  _id?: { toString(): string };
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  type?: ProfileUser["type"];
  studentInfo?: ProfileUser["studentInfo"];
  shifts?: ProfileUser["shifts"];
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

  const canEdit =
    viewerId === targetId ||
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
      firstName: session.user.firstName ?? session.user.email ?? "User",
      lastName: session.user.lastName ?? "",
      email: session.user.email as string,
      type: session.user.type as ProfileUser["type"],
      studentInfo: null,
    };

    return (
      <ProfileView
        user={selfFromSession}
        canEdit={canEdit}
        viewerType={viewerType as UserType}
      />
    );
  }

  const doc = data as UserDocument;
  const user: ProfileUser = {
    id: doc._id?.toString?.() ?? targetId,
    firstName:
      doc.firstName ??
      doc.name?.split(" ")[0] ??
      session.user.firstName ??
      session.user.email ??
      "User",
    lastName:
      doc.lastName ??
      (doc.name ? doc.name.split(" ").slice(1).join(" ") : "") ??
      session.user.lastName ??
      "",
    email: doc.email ?? (session.user.email as string),
    type: doc.type ?? (session.user.type as ProfileUser["type"]),
    studentInfo: doc.studentInfo ?? null,
    shifts: doc.shifts ?? [],
  };

  return (
    <ProfileView
      user={user}
      canEdit={canEdit}
      viewerType={viewerType as UserType}
    />
  );
}
