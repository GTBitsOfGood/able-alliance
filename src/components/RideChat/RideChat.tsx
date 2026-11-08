"use client";

import { useEffect, useRef, type ReactNode } from "react";
import BogIcon from "@/components/BogIcon/BogIcon";
import ChatSystemMessage from "@/components/ChatSystemMessage/ChatSystemMessage";
import type { ChatMessageResponse } from "@/types/api";
import { getChatSenderType, isOwnChatMessage } from "@/utils/chat";
import { UserType } from "@db/generated/enums";
import styles from "./styles.module.css";

type RideChatProps = {
  title: string;
  subtitle?: string;
  presentation?: "dialog" | "inline" | "panel";
  headerAccessory?: ReactNode;
  messages: ChatMessageResponse[];
  currentUserId: string;
  currentUserType: UserType;
  studentId: string;
  driverId: string | null;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  connected: boolean;
  readOnly: boolean;
  loading?: boolean;
  error?: string | null;
};

/** The same transcript and composer for students, drivers, and admins. */
export default function RideChat({
  title,
  subtitle,
  presentation = "inline",
  headerAccessory,
  messages,
  currentUserId,
  currentUserType,
  studentId,
  driverId,
  input,
  onInputChange,
  onSend,
  onClose,
  connected,
  readOnly,
  loading = false,
  error,
}: RideChatProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (presentation !== "dialog") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [presentation, onClose]);

  const content = (
    <section
      className={
        presentation === "dialog"
          ? styles.chatModal
          : presentation === "panel"
            ? styles.panelChat
            : styles.inlineChat
      }
      role={presentation === "dialog" ? "dialog" : undefined}
      aria-modal={presentation === "dialog" || undefined}
      aria-label={title}
      onClick={(event) => event.stopPropagation()}
    >
      <div className={styles.chatModalHeader}>
        <div>
          <h2 className={styles.chatModalTitle}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        {headerAccessory}
        <button
          type="button"
          className={styles.chatModalCloseButton}
          onClick={onClose}
          aria-label="Close chat"
        >
          <BogIcon name="x" size={20} />
        </button>
      </div>
      {error && (
        <div className={styles.chatErrorBanner} role="alert">
          <p className={styles.chatErrorText}>{error}</p>
        </div>
      )}
      <div
        className={styles.messagesContainer}
        ref={transcriptRef}
        role="log"
        aria-label="Ride chat messages"
        aria-live="polite"
      >
        {loading && <p className={styles.noMessages}>Loading transcript...</p>}
        {!loading && messages.length === 0 && (
          <p className={styles.noMessages}>No messages yet.</p>
        )}
        {messages.map((message, index) => {
          if (message.senderId === null)
            return (
              <ChatSystemMessage
                key={message.id}
                text={message.text}
                time={message.time}
              />
            );
          const role = getChatSenderType(message, studentId, driverId);
          const own = isOwnChatMessage(message, currentUserId, currentUserType);
          const admin = role === UserType.Admin;
          const grouped =
            !own &&
            index > 0 &&
            messages[index - 1].senderId === message.senderId &&
            messages[index - 1].senderType === message.senderType &&
            getChatSenderType(messages[index - 1], studentId, driverId) ===
              role;
          const label = message.author
            ? `${role}: ${message.author.name}`
            : role;
          return (
            <div
              key={message.id}
              className={`${styles.messageRow} ${own ? styles.messageRowUser : styles.messageRowOther}`}
            >
              {!own &&
                (grouped ? (
                  <div className={styles.messageAvatarSpacer} />
                ) : (
                  <div className={styles.messageAvatar}>
                    <BogIcon name="user" size={18} />
                  </div>
                ))}
              <div className={styles.messageContent}>
                <span className={styles.adminMessageLabel}>
                  {own ? `${label} (you)` : label}
                </span>
                <div
                  className={`${styles.messageBubble} ${admin ? styles.adminMessageBubble : ""}`}
                >
                  <p className={styles.messageText}>{message.text}</p>
                </div>
                <time
                  className={styles.messageTime}
                  dateTime={message.time}
                  title={new Date(message.time).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                    timeZoneName: "short",
                  })}
                >
                  {new Date(message.time).toLocaleTimeString("en-US", {
                    timeZone: "America/New_York",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </time>
              </div>
            </div>
          );
        })}
      </div>
      {readOnly ? (
        <p className={styles.readOnlyNotice}>
          This ride has ended. The chat is read-only.
        </p>
      ) : (
        <form
          className={styles.chatInputContainer}
          onSubmit={(event) => {
            event.preventDefault();
            if (connected && input.trim()) onSend();
          }}
        >
          <input
            type="text"
            className={styles.chatInput}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Type a message..."
            aria-label="Chat message"
            disabled={!connected}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!connected || !input.trim()}
            aria-label="Send message"
          >
            <BogIcon name="paper-plane-right" size={24} weight="regular" />
          </button>
        </form>
      )}
    </section>
  );
  return presentation === "dialog" ? (
    <div className={styles.chatModalOverlay} onClick={onClose}>
      {content}
    </div>
  ) : (
    content
  );
}
