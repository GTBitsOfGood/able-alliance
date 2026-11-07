"use client";

import type { PendingMessage } from "@/hooks/useChatSender";
import styles from "./styles.module.css";

/**
 * Messages the server has not confirmed yet, shown at the end of the thread
 * so the text is never lost to a failed send. A failed message can be sent
 * again — the retry carries the same client id, so it cannot duplicate.
 */
export default function PendingMessages({
  pending,
  onRetry,
  onEdit,
}: {
  pending: PendingMessage[];
  onRetry: (clientId: string) => void;
  onEdit: (item: PendingMessage) => void;
}) {
  if (pending.length === 0) return null;

  return (
    <>
      {pending.map((item) => (
        <div
          key={item.clientId}
          className={`${styles.messageRow} ${styles.messageRowUser}`}
        >
          <div
            className={`${styles.messageBubble} ${
              item.status === "failed"
                ? styles.failedMessageBubble
                : styles.pendingMessageBubble
            }`}
          >
            <p className={styles.messageText}>{item.text}</p>
            {item.status === "sending" ? (
              <span className={styles.messageStatus}>Sending…</span>
            ) : (
              <span className={styles.messageStatus} role="alert">
                {item.error ?? "Not sent"}
                {item.retryable && (
                  <button
                    type="button"
                    className={styles.messageStatusAction}
                    onClick={() => onRetry(item.clientId)}
                  >
                    Retry
                  </button>
                )}
                <button
                  type="button"
                  className={styles.messageStatusAction}
                  onClick={() => onEdit(item)}
                >
                  Edit
                </button>
              </span>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
