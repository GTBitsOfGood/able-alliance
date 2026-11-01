import { NextRequest, NextResponse } from "next/server";
import { AuditAction, Prisma } from "@db/generated/client";
import { db } from "@db";
import { getUserFromRequest, isAdmin } from "@/utils/authUser";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { errorResponse } from "@/utils/errors";

const ENTITY_TYPES = [
  "User",
  "Vehicle",
  "Location",
  "Accommodation",
  "Route",
  "RideSeries",
  "Message",
] as const;

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

  if (entityType && !(ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return NextResponse.json(
      { error: "Invalid entity type" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  if (action && !Object.values(AuditAction).includes(action as AuditAction)) {
    return NextResponse.json(
      { error: "Invalid audit action" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  const where: Prisma.AuditEntryWhereInput = {
    ...(entityType ? { entityType } : {}),
    ...(action ? { action: action as AuditAction } : {}),
  };

  try {
    const [entries, total] = await db.$transaction([
      db.auditEntry.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          actor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              preferredName: true,
              username: true,
            },
          },
        },
      }),
      db.auditEntry.count({ where }),
    ]);
    return NextResponse.json({
      entries,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
      entityTypes: ENTITY_TYPES,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
