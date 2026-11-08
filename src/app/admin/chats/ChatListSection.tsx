"use client";

import BogTextInput from "@/components/BogTextInput/BogTextInput";
import type { AdminChatSummaryResponse } from "@/types/api";
import styles from "./styles.module.css";

type ChatUser = AdminChatSummaryResponse["student"];
export const chatName = (user: ChatUser) =>
  `${user.preferredName || user.firstName} ${user.lastName}`.trim();

export function chatParticipants(chat: AdminChatSummaryResponse) {
  return `Student: ${chatName(chat.student)}, Driver: ${chat.driver ? chatName(chat.driver) : "Unassigned"}`;
}

export function chatTime(value: string | null) {
  return value
    ? new Date(value).toLocaleTimeString("en-US", {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
}

export default function ChatListSection({
  title,
  chats,
  search,
  onSearch,
  selectedId,
  onSelect,
  loading,
}: {
  title: "Active Chats" | "Closed Chats";
  chats: AdminChatSummaryResponse[];
  search: string;
  onSearch: (value: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  const query = search.trim().toLowerCase();
  const filtered = chats.filter((chat) =>
    [
      chatParticipants(chat),
      chat.pickup.name,
      chat.dropoff.name,
      chat.preview,
      new Date(chat.scheduledPickupTime).toLocaleDateString("en-US", {
        timeZone: "America/New_York",
      }),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query),
  );
  const headingId = title === "Active Chats" ? "active-chats" : "closed-chats";
  return (
    <section className={styles.listSection} aria-labelledby={headingId}>
      <h1 id={headingId} className="text-display m-0">
        {title}
      </h1>
      <label className={styles.searchLabel}>
        <span className={styles.srOnly}>Search {title.toLowerCase()}</span>
        <BogTextInput
          type="search"
          name={headingId + "-search"}
          placeholder="Search for a chat..."
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className={styles.search}
          iconProps={{
            position: "right",
            iconProps: { name: "search", size: 16 },
          }}
        />
      </label>
      <div className={styles.chatList}>
        {loading ? (
          <p className={styles.empty} role="status">
            Loading chats...
          </p>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>
            {query
              ? "No chats match your search."
              : `There are no ${title === "Active Chats" ? "active" : "closed"} chats at this time.`}
          </p>
        ) : (
          filtered.map((chat) => (
            <button
              type="button"
              key={chat.id}
              className={`${styles.chatCard} ${selectedId === chat.id ? styles.selectedCard : ""}`}
              onClick={() => onSelect(chat.id)}
              aria-pressed={selectedId === chat.id}
              aria-controls="chat-conversation"
              title={chatParticipants(chat)}
            >
              <span className={styles.cardHeading}>
                <span className={styles.participants}>
                  {chatParticipants(chat)}
                </span>
                <time
                  className={styles.activityTime}
                  dateTime={chat.lastActivity}
                  title={new Date(chat.lastActivity).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                  })}
                >
                  {chatTime(chat.lastActivity)}
                </time>
              </span>
              <span className={styles.itinerary}>
                <span className={styles.stop}>
                  <strong>{chatTime(chat.scheduledPickupTime)}</strong>
                  <span>{chat.pickup.name}</span>
                </span>
                <span className={`${styles.stop} ${styles.dropoff}`}>
                  <strong>{chatTime(chat.estimatedDropoffTime)}</strong>
                  <span>{chat.dropoff.name}</span>
                </span>
              </span>
              <span className={styles.preview}>{chat.preview}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
