import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserById } from "@/server/db/actions/UserAction";
import { NotFoundError } from "@/utils/errors";
import { ProfileView } from "../ProfileView";

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

  const data = await getUserById(targetId).catch((error) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });

  if (!data) redirect("/");

  const user = data;

  const isOwnProfile = viewerId === targetId;
  const targetType = user.type;
  const canDelete =
    !isOwnProfile &&
    (viewerType === "SuperAdmin" ||
      (viewerType === "Admin" &&
        (targetType === "Student" || targetType === "Driver")));

  return (
    <ProfileView
      user={user}
      canEdit={canEdit}
      viewerType={viewerType}
      isOwnProfile={isOwnProfile}
      canDelete={canDelete}
    />
  );
}
