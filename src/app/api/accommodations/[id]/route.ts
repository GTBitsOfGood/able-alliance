import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import {
  deleteAccommodation,
  renameAccommodation,
} from "@/server/db/actions/AccommodationAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { isValidId } from "@/utils/ids";
import { errorResponse } from "@/utils/errors";

export async function PATCH(
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
  if (!isAdmin(user.type)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid accommodation ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  const body = await req.json().catch(() => ({}));
  const newLabel = typeof body.label === "string" ? body.label.trim() : null;
  if (!newLabel) {
    return NextResponse.json(
      { error: "label is required" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    const updated = await renameAccommodation(id, newLabel);
    return NextResponse.json(updated, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _req: NextRequest,
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
  if (!isAdmin(user.type)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }
  const { id } = await params;
  if (!isValidId(id)) {
    return NextResponse.json(
      { error: "Invalid accommodation ID" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  try {
    await deleteAccommodation(id);
    return NextResponse.json(
      { message: "Accommodation deleted" },
      { status: HTTP_STATUS_CODE.OK },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
