import { NextRequest, NextResponse } from "next/server";
import { getChatlogById } from "@/server/db/actions/ChatlogAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";

// GET /api/chat-logs/:id
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const chatlog = await getChatlogById(params.id);
    if (!chatlog) {
      return NextResponse.json(
        { error: "Chatlog not found" },
        { status: HTTP_STATUS_CODE.NOT_FOUND },
      );
    }
    return NextResponse.json(chatlog, { status: HTTP_STATUS_CODE.OK });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch chatlog" },
      { status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR },
    );
  }
}
