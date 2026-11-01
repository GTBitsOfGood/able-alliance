import { NextRequest, NextResponse } from "next/server";
import { getAuditEntries, isAuditAction, isAuditEntityType } from "@db/audit";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { errorResponse } from "@/utils/errors";

export async function GET(request: NextRequest) {
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

  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(params.get("pageSize") ?? "50", 10) || 50),
  );
  const entityType = params.get("entityType");
  const action = params.get("action");
  const query: Parameters<typeof getAuditEntries>[0] = { page, pageSize };

  if (entityType) {
    if (!isAuditEntityType(entityType)) {
      return NextResponse.json(
        { error: "Invalid entity type" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    query.entityType = entityType;
  }
  if (action) {
    if (!isAuditAction(action)) {
      return NextResponse.json(
        { error: "Invalid audit action" },
        { status: HTTP_STATUS_CODE.BAD_REQUEST },
      );
    }
    query.action = action;
  }

  try {
    return NextResponse.json(await getAuditEntries(query));
  } catch (error) {
    return errorResponse(error);
  }
}
