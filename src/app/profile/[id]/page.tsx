import { hasAdminType } from "@/utils/userTypes";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  driverProfileResponse,
  getUserById,
} from "@/server/actions/UserAction";
import { isAdmin } from "@/utils/authUser";
import { NotFoundError } from "@/utils/errors";
import { ProfileView } from "@/app/profile/ProfileView";

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
  const viewerType = session.user.activeType;

  const canView =
    viewerId === targetId || viewerType === "Driver" || isAdmin(viewerType);

  const canEdit = viewerId === targetId || isAdmin(viewerType);

  if (!canView) {
    redirect("/"); // default redirect to home if not allowed
  }

  const data = await getUserById(targetId).catch((error) => {
    if (error instanceof NotFoundError) return null;
    throw error;
  });

  if (!data) redirect("/");

  const isOwnProfile = viewerId === targetId;
  const user =
    viewerType === "Driver" && !isOwnProfile
      ? driverProfileResponse(data)
      : data;
  const targetIsAdmin = hasAdminType(data);
  const canDelete =
    !isOwnProfile &&
    (viewerType === "SuperAdmin" || (isAdmin(viewerType) && !targetIsAdmin));

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
