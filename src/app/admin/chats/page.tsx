"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import BogButton from "@/components/BogButton/BogButton";

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

function ChatsTable({ chats }: { chats: ChatlogEntry[] }) {
  if (chats.length === 0) {
    return <p className="text-gray-600">No chats found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="p-3">Student</th>
            <th className="p-3">Driver</th>
            <th className="p-3">Started</th>
            <th className="p-3">Status</th>
            <th className="p-3">Chat</th>
          </tr>
        </thead>
        <tbody>
          {chats.map((chat) => {
            const routeId = String(chat.routeId);
            return (
              <tr key={routeId} className="border-b last:border-b-0">
                <td className="p-3">
                  {chat.student.firstName} {chat.student.lastName}
                </td>
                <td className="p-3">
                  {chat.driver
                    ? `${chat.driver.firstName} ${chat.driver.lastName}`
                    : "—"}
                </td>
                <td className="p-3">{new Date(chat.time).toLocaleString()}</td>
                <td className="p-3 capitalize">{chat.status}</td>
                <td className="p-3">
                  <Link href={`/admin/chat/${encodeURIComponent(routeId)}`}>
                    <BogButton variant="secondary" size="small">
                      Open
                    </BogButton>
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminChatsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [chatlogs, setChatlogs] = useState<ChatlogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (sessionStatus === "loading" || loading) {
    return <main className="p-6 text-gray-600">Loading chats...</main>;
  }

  const isAuthorized =
    session?.user?.type === "Admin" || session?.user?.type === "SuperAdmin";

  return (
    <main className="p-6">
      <h1 className="mb-6 text-3xl font-semibold">Chats</h1>
      {!isAuthorized && (
        <p className="mb-4 text-sm text-red-700" role="alert">
          You do not have access to chats.
        </p>
      )}
      {isAuthorized && error && (
        <p className="mb-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {isAuthorized && !error && <ChatsTable chats={chatlogs} />}
    </main>
  );
}
