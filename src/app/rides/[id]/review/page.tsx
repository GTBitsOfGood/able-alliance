import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import RideReview from "./RideReview";

export default async function ReviewRidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getUserFromRequest();

  return <RideReview routeId={id} admin={isAdmin(user.activeType)} />;
}
