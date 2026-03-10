import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { getChatlogs } from "@/server/db/actions/ChatlogAction";
import { isValidObjectId } from "mongoose";
import { HTTP_STATUS_CODE } from "@/utils/consts";

// GET /api/chat-logs
// Retrieves chatlogs with optional filters
export async function GET(req: NextRequest) {
  let user;
  try {
    user = await getUserFromRequest();
  } catch {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }
  const url = new URL(req.url);
  const filters = {
    studentId: url.searchParams.get("studentId"),
    driverId: url.searchParams.get("driverId"),
    routeId: url.searchParams.get("routeId"),
    startDate: url.searchParams.get("startDate"),
    endDate: url.searchParams.get("endDate"),
  };

  // Remove null values
  const validFilters = Object.fromEntries(
    Object.entries(filters).filter(([_, value]) => value !== null),
  ) as Record<string, string>;

  // Validate ObjectId fields
  if (filters.studentId && !isValidObjectId(filters.studentId)) {
    return NextResponse.json(
      { error: "Invalid studentId" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  if (filters.driverId && !isValidObjectId(filters.driverId)) {
    return NextResponse.json(
      { error: "Invalid driverId" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  if (filters.routeId && !isValidObjectId(filters.routeId)) {
    return NextResponse.json(
      { error: "Invalid routeId" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  // Validate date fields
  if (filters.startDate && isNaN(Date.parse(filters.startDate))) {
    return NextResponse.json(
      { error: "Invalid startDate" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }
  if (filters.endDate && isNaN(Date.parse(filters.endDate))) {
    return NextResponse.json(
      { error: "Invalid endDate" },
      { status: HTTP_STATUS_CODE.BAD_REQUEST },
    );
  }

  // Only allow: Admin/SuperAdmin, or participant (studentId/driverId matches userId)
  if (
    user.type !== "Admin" &&
    user.type !== "SuperAdmin" &&
    !(
      (user.type === "Student" && filters.studentId === user.userId) ||
      (user.type === "Driver" && filters.driverId === user.userId)
    )
  ) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  }

  try {
    const chatlogs = await getChatlogs(validFilters);
    return NextResponse.json(chatlogs);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch chatlogs" },
      { status: 500 },
    );
  }
}
