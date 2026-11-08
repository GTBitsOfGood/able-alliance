"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import AdminChatView from "@/components/admin/AdminChatView";
import BogButton from "@/components/BogButton/BogButton";
import { useRouteUpdates } from "@/hooks/useRouteUpdates";
import { isRideChatOpen } from "@/utils/route-status";
import type { AdminChatSummaryResponse } from "@/types/api";
import ChatListSection, { chatParticipants } from "./ChatListSection";
import styles from "./styles.module.css";

export default function AdminChatsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [chats, setChats] = useState<AdminChatSummaryResponse[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSearch, setActiveSearch] = useState("");
  const [closedSearch, setClosedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const isAuthorized =
    session?.user?.activeType === "Admin" ||
    session?.user?.activeType === "SuperAdmin";

  const loadChats = useCallback(
    async (signal?: AbortSignal) => {
      if (sessionStatus !== "authenticated" || !isAuthorized) return;
      const current = ++requestId.current;
      try {
        const response = await fetch("/api/chats", { signal });
        if (!response.ok)
          throw new Error("Unable to load chats. Please try again.");
        const data: AdminChatSummaryResponse[] = await response.json();
        if (current !== requestId.current || signal?.aborted) return;
        setChats(data);
        setError(null);
      } catch (caught) {
        if (current === requestId.current && !signal?.aborted)
          setError(
            caught instanceof Error ? caught.message : "Unable to load chats.",
          );
      } finally {
        if (current === requestId.current && !signal?.aborted)
          setLoading(false);
      }
    },
    [sessionStatus, isAuthorized],
  );

  useEffect(() => {
    const controller = new AbortController();
    // This starts an asynchronous API request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadChats(controller.signal);
    // Refresh previews for conversations other than the one currently open.
    const refresh = () => {
      if (document.visibilityState === "visible")
        void loadChats(controller.signal);
    };
    const interval = window.setInterval(refresh, 15_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadChats]);
  useRouteUpdates(() => {
    void loadChats();
  });

  const selected = chats.find((chat) => chat.id === selectedId);
  const active = chats.filter((chat) => isRideChatOpen(chat.status));
  const closed = chats.filter((chat) => !isRideChatOpen(chat.status));

  if (sessionStatus !== "loading" && !isAuthorized)
    return (
      <main className={styles.accessError}>
        <h1>Chats</h1>
        <p role="alert">You do not have access to chats.</p>
      </main>
    );

  return (
    <main
      className={`${styles.page} ${selected ? styles.hasSelection : ""}`}
      aria-label="Ride chats"
    >
      <div className={styles.listPanel}>
        {error && (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            <BogButton
              variant="secondary"
              size="small"
              onClick={() => {
                void loadChats();
              }}
            >
              Retry
            </BogButton>
          </div>
        )}
        <ChatListSection
          title="Active Chats"
          chats={active}
          search={activeSearch}
          onSearch={setActiveSearch}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={loading}
        />
        <ChatListSection
          title="Closed Chats"
          chats={closed}
          search={closedSearch}
          onSearch={setClosedSearch}
          selectedId={selectedId}
          onSelect={setSelectedId}
          loading={loading}
        />
      </div>
      <div id="chat-conversation" className={styles.conversationPanel}>
        {selected ? (
          <AdminChatView
            key={selected.id}
            presentation="panel"
            routeId={selected.id}
            rideLabel={chatParticipants(selected)}
            routeStatus={selected.status}
            studentId={selected.student.id}
            driverId={selected.driver?.id ?? null}
            onClose={() => setSelectedId(null)}
            onActivity={() => {
              void loadChats();
            }}
          />
        ) : (
          <div className={styles.emptyConversation}>
            <p>Select a chat to view.</p>
          </div>
        )}
      </div>
    </main>
  );
}
