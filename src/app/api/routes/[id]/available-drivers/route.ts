import { NextResponse } from "next/server";
import { getAvailableDriversForRoute } from "@/server/autoSchedule";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { isValidId } from "@/utils/ids";
import { errorResponse } from "@/utils/errors";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }

  if (!isAdmin(user.activeType)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }

  const { id } = await context.params;
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid route ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  try {
    const driverIds = await getAvailableDriversForRoute(id);
    return NextResponse.json({ driverIds }, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    return errorResponse(error);
  }
}
