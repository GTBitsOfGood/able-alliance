"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import BogTable, {
  type ColumnHeaderCellContent,
  type TableRow,
} from "@/components/BogTable/BogTable";
import AdminChatView from "@/app/admin/AdminChatView";
import styles from "./styles.module.css";

type ChatUser = {
  firstName: string;
  lastName: string;
};

type ChatlogEntry = {
  routeId: string | { toString(): string };
  student: ChatUser;
  driver?: ChatUser;
  time: string;
  status: "active" | "archived";
};

const COLUMNS: ColumnHeaderCellContent[] = [
  { content: "Student", datatype: "string" },
  { content: "Driver", datatype: "string" },
  { content: "Started", datatype: "string" },
  { content: "Status", datatype: "string" },
  { content: "Chat", datatype: "string" },
];

export default function AdminChatsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [chatlogs, setChatlogs] = useState<ChatlogEntry[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatlogEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isAuthorized =
    session?.user?.type === "Admin" || session?.user?.type === "SuperAdmin";

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    if (session.user.type !== "Admin" && session.user.type !== "SuperAdmin")
      return;

    const loadChats = async () => {
      try {
        const response = await fetch("/api/chat-logs");
        if (!response.ok) throw new Error("Unable to load chats.");

        const data = await response.json();
        setChatlogs(
          Array.isArray(data)
            ? (data as ChatlogEntry[]).sort(
                (a, b) =>
                  new Date(b.time).getTime() - new Date(a.time).getTime(),
              )
            : [],
        );
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to load chats.",
        );
      } finally {
        setLoading(false);
      }
    };

    void loadChats();
  }, [session, sessionStatus]);

  if (sessionStatus === "loading") {
    return <main className="p-6 text-gray-600">Loading chats...</main>;
  }

  if (!isAuthorized) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Chats</h1>
        <p className={styles.error} role="alert">
          You do not have access to chats.
        </p>
      </main>
    );
  }

  if (loading) {
    return <main className="p-6 text-gray-600">Loading chats...</main>;
  }

  const rows: TableRow[] = chatlogs.map((chat) => ({
    styleProps: { id: `chat-${String(chat.routeId)}` },
    cells: [
      { content: `${chat.student.firstName} ${chat.student.lastName}` },
      {
        content: chat.driver
          ? `${chat.driver.firstName} ${chat.driver.lastName}`
          : "—",
      },
      { content: new Date(chat.time).toLocaleString() },
      { content: chat.status === "active" ? "Active" : "Archived" },
      { content: <span className={styles.viewChat}>View chat</span> },
    ],
  }));

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Chats</h1>
      {isAuthorized && error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {isAuthorized && !error && (
        <div className={styles.tableWrap}>
          {chatlogs.length === 0 ? (
            <p className={styles.empty}>No chats found.</p>
          ) : (
            <BogTable
              columnHeaders={COLUMNS}
              rows={rows}
              onRowClick={(_, rowElement) => {
                const routeId = rowElement.id.replace(/^chat-/, "");
                setSelectedChat(
                  chatlogs.find((chat) => String(chat.routeId) === routeId) ??
                    null,
                );
              }}
            />
          )}
        </div>
      )}

      {selectedChat && (
        <div className={styles.drawerLayer}>
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label="Close chat"
            onClick={() => setSelectedChat(null)}
          />
          <aside className={styles.drawer} aria-label="Chat transcript">
            <AdminChatView
              routeId={String(selectedChat.routeId)}
              rideLabel={[
                `${selectedChat.student.firstName} ${selectedChat.student.lastName}`,
                selectedChat.driver
                  ? `Driver: ${selectedChat.driver.firstName} ${selectedChat.driver.lastName}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              routeStatus={selectedChat.status}
              onClose={() => setSelectedChat(null)}
            />
          </aside>
        </div>
      )}
    </main>
  );
}
