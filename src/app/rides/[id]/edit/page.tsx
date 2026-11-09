import { RideForm } from "@/app/rides/new/RideForm";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";

export default async function EditRidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await getUserFromRequest();

  return <RideForm editId={id} admin={isAdmin(user.activeType)} />;
}
