import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { materializeDueSeries } from "@/server/db/actions/RideSeriesAction";
import { HTTP_STATUS_CODE } from "@/utils/consts";
import { internalErrorPayload } from "@/utils/apiError";

/**
 * Internal trigger for the recurring-ride materializer, called by the cron on the
 * websocket server.
 *
 * Not reachable by browsers: it carries no user session and is gated on the same
 * shared secret as the Next -> websocket /notify hop. The work itself is
 * idempotent and lock-guarded, so an extra call is harmless.
 */
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.WEBSOCKET_INTERNAL_SECRET;
  const provided = req.headers.get("x-internal-secret");
  if (!expected || !provided) {
    return false;
  }

  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: HTTP_STATUS_CODE.UNAUTHORIZED },
    );
  }

  try {
    const result = await materializeDueSeries();
    console.log(
      `[RideSeries] pass complete: ${result.seriesProcessed} series, ` +
        `${result.ridesCreated} created, ${result.ridesSkipped} skipped`,
    );
    return NextResponse.json(result, { status: HTTP_STATUS_CODE.OK });
  } catch (e) {
    console.error("[RideSeries] materialize failed:", e);
    return NextResponse.json(internalErrorPayload(e), {
      status: HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    });
  }
}

export const dynamic = "force-dynamic";
