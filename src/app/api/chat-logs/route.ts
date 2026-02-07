import { NextRequest, NextResponse } from "next/server";
import { getChatlogs } from "@/server/db/actions/ChatlogAction";

// GET /api/chat-logs
// Retrieves chatlogs with optional filters
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const filters = {
    studentId: url.searchParams.get("studentId"),
    driverId: url.searchParams.get("driverId"),
    routeId: url.searchParams.get("routeId"),
    startDate: url.searchParams.get("startDate"),
    endDate: url.searchParams.get("endDate"),
  };

  try {
    const chatlogs = await getChatlogs(filters);
    return NextResponse.json(chatlogs);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch chatlogs" },
      { status: 500 },
    );
  }
}
