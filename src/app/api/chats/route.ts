import { NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { getAdminChatSummaries } from "@/server/actions/MessageAction";
import { errorResponse } from "@/utils/errors";

export async function GET() {
  const user = await getUserFromRequest().catch(() => null);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(user.activeType))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    return NextResponse.json(await getAdminChatSummaries());
  } catch (error) {
    return errorResponse(error);
  }
}
