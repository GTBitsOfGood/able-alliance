import type { UserType } from "@db/generated/enums";
import { TOAST_DELIVERY_TIMEOUT_MS } from "@/utils/consts";

export type ToastType = "success" | "error" | "info" | "warn";

export type ToastPayload = { type: ToastType; message: string };

/**
 * Best-effort push of a real-time toast to a user's active-role connections.
 * Never throws — a failure here must not interfere with the caller's
 * primary flow (route status update, email send).
 */
export async function emitToast(
  userId: string,
  activeType: UserType,
  payload: ToastPayload,
): Promise<void> {
  const url = process.env.WEBSOCKET_INTERNAL_URL;
  const secret = process.env.WEBSOCKET_INTERNAL_SECRET;

  if (!url || !secret) {
    console.error("emitToast: WEBSOCKET_INTERNAL_URL/SECRET not configured");
    return;
  }

  try {
    const res = await fetch(`${url}/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": secret,
      },
      body: JSON.stringify({ userId, activeType, ...payload }),
      signal: AbortSignal.timeout(TOAST_DELIVERY_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.error(`emitToast: notify failed with status ${res.status}`);
      return;
    }

    const body = (await res.json().catch(() => null)) as {
      delivered?: boolean;
    } | null;

    console.log(
      `emitToast: POST /notify ok for user ${userId} (type=${payload.type}, delivered=${body?.delivered})`,
    );
  } catch (error) {
    console.error("emitToast: failed to reach websocket server", error);
  }
}
