import { editRouteSchema, rideReviewSchema } from "@/schemas/ride";
import { ArgumentError } from "@/utils/errors";
import { editOrAcceptRoute } from "@/server/actions/RouteAction";
import { routeResponseForRole } from "@/server/queries";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { isValidId } from "@/utils/ids";
import { deleteRoute, getRouteById } from "@/server/actions/RouteAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { errorResponse } from "@/utils/errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid route ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    const route = await getRouteById(id, user.activeType);
    // Only allow: Admin/SuperAdmin, or owner (student.id or driver.id matches userId)
    if (
      isAdmin(user.activeType) ||
      route.student?.id === user.userId ||
      route.driver?.id === user.userId
    ) {
      return NextResponse.json(route, { status: HTTP_STATUS_CODE.OK });
    }
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid route ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    await deleteRoute(id, user.userId);
    return NextResponse.json(
      { message: "Route deleted" },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!isValidId(id))
    return NextResponse.json({ error: "Invalid route ID" }, { status: 400 });
  try {
    const body = await req.json().catch(() => {
      throw new ArgumentError("Malformed request body");
    });

    if (body && typeof body === "object" && "recurring" in body) {
      throw new ArgumentError(
        "Recurrence cannot be changed when editing a ride. Cancel the affected rides and submit a new request.",
      );
    }

    const isReview = body && typeof body === "object" && "action" in body;

    const review = isReview ? rideReviewSchema.safeParse(body) : null;

    const edit = !isReview ? editRouteSchema.safeParse(body) : null;

    if ((review && !review.success) || (edit && !edit.success))
      throw new ArgumentError("Invalid ride details.");

    const route = await editOrAcceptRoute(
      id,
      user,
      edit?.success ? edit.data : null,
      review?.success ? review.data : undefined,
    );

    return NextResponse.json(routeResponseForRole(route, user.activeType));
  } catch (error) {
    return errorResponse(error);
  }
}
