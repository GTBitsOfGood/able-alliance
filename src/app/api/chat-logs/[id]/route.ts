import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/utils/authUser";
import { getChatlogById } from "@/server/db/actions/ChatlogAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";

// GET /api/chat-logs/:id
export async function GET(
  req: NextRequest,
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
  const { id } = await context.params; // Await params before accessing id
  try {
    const chatlog = await getChatlogById(id);
    if (!chatlog) {
      return NextResponse.json(
        { error: "Chatlog not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    // Only allow: Admin/SuperAdmin, or participant (student/driver matches userId)
    if (
      user.type === "Admin" ||
      user.type === "SuperAdmin" ||
      (user.type === "Student" &&
        chatlog.student._id.toString() === user.userId) ||
      (user.type === "Driver" && chatlog.driver._id.toString() === user.userId)
    ) {
      return NextResponse.json(chatlog, { status: HTTP_STATUS_CODE.OK });
    }
    return NextResponse.json(
      { error: "Forbidden" },
      { status: HTTP_STATUS_CODE.FORBIDDEN },
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch chatlog" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
