"use client";

import { useCallback, useState } from "react";
import type { Socket } from "socket.io-client";

/**
 * Outgoing chat messages that the server has not confirmed yet.
 *
 * A message is only dropped from this list once the server acknowledges that
 * it was saved, so nothing a user typed disappears because a send failed or
 * the connection dropped mid-flight. Each attempt carries a `clientId` that
 * the server stores, so retrying is safe: a retry whose first attempt did in
 * fact save returns the stored message instead of writing a duplicate.
 */

export type PendingStatus = "sending" | "failed";

export type PendingMessage = {
  clientId: string;
  text: string;
  status: PendingStatus;
  error?: string;
  /** False for failures that retrying cannot fix, e.g. a closed chat. */
  retryable: boolean;
};

type SendChatAck =
  | { status: "ok"; message: unknown }
  | { status: "error"; error: string; retryable: boolean };

/** How long to wait for the server's acknowledgement before giving up. */
const ACK_TIMEOUT_MS = 10_000;

function newClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Pre-2021 Safari and non-secure origins have no randomUUID.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useChatSender(socketRef: React.RefObject<Socket | null>) {
  const [pending, setPending] = useState<PendingMessage[]>([]);

  const markFailed = useCallback(
    (clientId: string, error: string, retryable: boolean) => {
      setPending((current) =>
        current.map((item) =>
          item.clientId === clientId
            ? { ...item, status: "failed", error, retryable }
            : item,
        ),
      );
    },
    [],
  );

  const attempt = useCallback(
    (clientId: string, text: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) {
        markFailed(clientId, "You're offline. The message wasn't sent.", true);
        return;
      }

      socket
        .timeout(ACK_TIMEOUT_MS)
        .emit(
          "sendChatMessage",
          { text, clientId },
          (timeoutError: Error | null, ack?: SendChatAck) => {
            if (timeoutError) {
              // The save may or may not have landed. Retrying is still safe:
              // the clientId makes a second attempt return the stored message.
              markFailed(
                clientId,
                "No response from the server. Tap to retry.",
                true,
              );
              return;
            }
            if (ack?.status === "ok") {
              setPending((current) =>
                current.filter((item) => item.clientId !== clientId),
              );
              return;
            }
            markFailed(
              clientId,
              ack?.error ?? "Failed to send message",
              ack?.retryable ?? true,
            );
          },
        );
    },
    [markFailed, socketRef],
  );

  /** Queues a message and sends it. Returns false if there was nothing to send. */
  const send = useCallback(
    (rawText: string) => {
      const text = rawText.trim();
      if (!text) return false;

      const clientId = newClientId();
      setPending((current) => [
        ...current,
        { clientId, text, status: "sending", retryable: true },
      ]);
      attempt(clientId, text);
      return true;
    },
    [attempt],
  );

  const retry = useCallback(
    (clientId: string) => {
      setPending((current) => {
        const item = current.find((entry) => entry.clientId === clientId);
        if (item) attempt(clientId, item.text);
        return current.map((entry) =>
          entry.clientId === clientId
            ? { ...entry, status: "sending", error: undefined }
            : entry,
        );
      });
    },
    [attempt],
  );

  /** Abandons a failed message, after letting the user copy the text back. */
  const discard = useCallback((clientId: string) => {
    setPending((current) =>
      current.filter((item) => item.clientId !== clientId),
    );
  }, []);

  /** Re-sends everything still outstanding, e.g. once the socket reconnects. */
  const retryAll = useCallback(() => {
    setPending((current) => {
      for (const item of current) {
        if (item.status === "failed" && item.retryable)
          attempt(item.clientId, item.text);
      }
      return current.map((item) =>
        item.status === "failed" && item.retryable
          ? { ...item, status: "sending", error: undefined }
          : item,
      );
    });
  }, [attempt]);

  return { pending, send, retry, discard, retryAll };
}
