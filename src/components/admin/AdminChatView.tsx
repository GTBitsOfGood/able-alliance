"use client";

import { RouteStatus } from "@db/generated/enums";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import BogButton from "@/components/BogButton/BogButton";
import { useChatSender } from "@/hooks/useChatSender";

type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
  time: string | Date;
};

type Chatlog = {
  status: "active" | "archived";
  messages: ChatMessage[];
};

const CLOSED_ROUTE_STATUSES = new Set<RouteStatus>([
  RouteStatus.Completed,
  RouteStatus.Missing,
  RouteStatus.CancelledByStudent,
  RouteStatus.CancelledByAdmin,
]);

export default function AdminChatView({
  routeId,
  rideLabel,
  routeStatus,
  studentId,
  driverId,
  onClose,
}: {
  routeId: string;
  rideLabel: string;
  routeStatus: RouteStatus;
  studentId: string;
  driverId: string | null;
  onClose: () => void;
}) {
  const { data: session } = useSession();
  const [chatlog, setChatlog] = useState<Chatlog | null>(null);
  const [input, setInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadMessages = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(
          `/api/routes/${encodeURIComponent(routeId)}/messages`,
        );
        if (!response.ok)
          throw new Error("Unable to load this ride transcript.");
        const data = (await response.json()) as ChatMessage[];
        if (!cancelled) {
          setChatlog({
            status: CLOSED_ROUTE_STATUSES.has(routeStatus)
              ? "archived"
              : "active",
            messages: Array.isArray(data) ? data : [],
          });
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof Error
              ? caught.message
              : "Unable to load this ride transcript.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadMessages();
    return () => {
      cancelled = true;
    };
  }, [routeId, routeStatus]);

  useEffect(() => {
    const token = session?.user?.accessToken;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!token || !wsUrl || chatlog?.status !== "active") return;

    const nextSocket = io(wsUrl, {
      auth: { routeId, token },
    });
    socketRef.current = nextSocket;

    nextSocket.on("connect", () => {
      setConnected(true);
      setSocketError(null);
    });
    nextSocket.on("disconnect", () => setConnected(false));
    nextSocket.on("routeClosed", () => {
      setConnected(false);
      setChatlog((current) =>
        current ? { ...current, status: "archived" } : current,
      );
      setSocketError("This ride has ended. The chat is now read-only.");
    });
    nextSocket.on("chatHistory", (messages: ChatMessage[]) => {
      setChatlog((current) =>
        current ? { ...current, messages } : { status: "active", messages },
      );
    });
    nextSocket.on("receiveChatMessage", (message: ChatMessage) => {
      setChatlog((current) =>
        current
          ? { ...current, messages: [...current.messages, message] }
          : current,
      );
    });
    nextSocket.on("chatError", (message: string) => setSocketError(message));
    nextSocket.on("connect_error", (connectionError) => {
      setConnected(false);
      setSocketError(
        `Unable to connect to the active ride chat: ${connectionError.message}`,
      );
    });

    return () => {
      nextSocket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [
    chatlog?.status,
    routeId,
    session?.user?.accessToken,
    session?.user?.userId,
  ]);

  const messages = useMemo(() => chatlog?.messages ?? [], [chatlog]);
  const { pending, send, retry, discard } = useChatSender(socketRef);

  // The draft is only cleared once the message is queued, and it stays
  // visible as a pending bubble until the server confirms the save.
  const sendMessage = () => {
    if (send(input)) setInput("");
  };

  return (
    <section
      aria-label={`Chat for ${rideLabel}`}
      className="mt-6 rounded-lg border p-5"
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Ride chat</h2>
          <p className="text-sm text-gray-600">{rideLabel}</p>
        </div>
        <BogButton variant="secondary" size="small" onClick={onClose}>
          Close
        </BogButton>
      </div>
      {loading && <p>Loading transcript...</p>}
      {loadError && <p className="mb-3 text-sm text-red-700">{loadError}</p>}
      {!loading && !loadError && (
        <>
          {socketError && (
            <p className="mb-3 text-sm text-red-700" role="alert">
              {socketError}
            </p>
          )}
          <div className="max-h-80 space-y-3 overflow-y-auto rounded border bg-gray-50 p-4">
            {messages.length === 0 && (
              <p className="text-sm text-gray-600">No messages yet.</p>
            )}
            {messages.map((message, index) => {
              const isOwnMessage = message.senderId === session?.user?.userId;
              const isStudentMessage = message.senderId === studentId;
              const isDriverMessage =
                driverId !== null && message.senderId === driverId;
              const isAdminMessage = !isStudentMessage && !isDriverMessage;
              const senderLabel = isStudentMessage
                ? "Student"
                : isDriverMessage
                  ? "Driver"
                  : isOwnMessage
                    ? "You · Admin"
                    : "Admin";
              return (
                <div
                  key={message.id ?? `${message.time}-${index}`}
                  className={`rounded border p-3 ${
                    isAdminMessage
                      ? "border-blue-200 bg-blue-50"
                      : "border-transparent bg-white"
                  }`}
                >
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-600">
                    {senderLabel}
                  </div>
                  <p>{message.text}</p>
                  <time className="text-xs text-gray-500">
                    {new Date(message.time).toLocaleString()}
                  </time>
                </div>
              );
            })}
            {pending.map((item) => (
              <div
                key={item.clientId}
                className={`rounded border p-3 ${
                  item.status === "failed"
                    ? "border-red-200 bg-red-50"
                    : "border-blue-200 bg-blue-50 opacity-70"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-gray-600">
                  You · Admin
                </div>
                <p>{item.text}</p>
                {item.status === "sending" ? (
                  <span className="text-xs text-gray-500">Sending…</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-red-700" role="alert">
                      {item.error ?? "Not sent"}
                    </span>
                    {item.retryable && (
                      <button
                        type="button"
                        className="font-semibold underline"
                        onClick={() => retry(item.clientId)}
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => {
                        setInput((current) =>
                          current.trim() ? current : item.text,
                        );
                        discard(item.clientId);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {chatlog?.status === "active" ? (
            <form
              className="mt-4 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                sendMessage();
              }}
            >
              <input
                className="min-w-0 flex-1 rounded border px-3 py-2"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Message the ride participants"
                aria-label="Chat message"
              />
              <BogButton type="submit" disabled={!connected || !input.trim()}>
                Send
              </BogButton>
            </form>
          ) : (
            <p className="mt-4 text-sm text-gray-600">
              This ride has ended. The chat is read-only.
            </p>
          )}
        </>
      )}
    </section>
  );
}
