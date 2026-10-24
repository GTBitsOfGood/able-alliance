"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";
import BogButton from "@/components/BogButton/BogButton";

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

const ACTIVE_ROUTE_STATUSES = new Set(["Scheduled", "EnRoute", "Pickedup"]);

export default function AdminChatView({
  routeId,
  rideLabel,
  routeStatus,
  onClose,
}: {
  routeId: string;
  rideLabel: string;
  routeStatus: string;
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

    const loadChatlog = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(
          `/api/routes/${encodeURIComponent(routeId)}/messages`,
        );
        if (!response.ok) {
          throw new Error("Unable to load this ride transcript.");
        }

        const data = (await response.json()) as ChatMessage[];
        if (!cancelled) {
          setChatlog({
            status: ACTIVE_ROUTE_STATUSES.has(routeStatus)
              ? "active"
              : "archived",
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

    void loadChatlog();
    return () => {
      cancelled = true;
    };
  }, [routeId, routeStatus]);

  useEffect(() => {
    const token = session?.user?.accessToken;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!token || !wsUrl || chatlog?.status !== "active") return;

    const nextSocket = io(wsUrl, {
      transports: ["websocket", "polling"],
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
      if (message.senderId === session?.user?.userId) {
        setInput((currentInput) =>
          currentInput.trim() === message.text ? "" : currentInput,
        );
      }
      setChatlog((current) =>
        current
          ? { ...current, messages: [...current.messages, message] }
          : current,
      );
    });
    nextSocket.on("chatError", (message: string) => {
      setSocketError(message);
    });
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

  const sendMessage = () => {
    const text = input.trim();
    if (!text || !socketRef.current?.connected) return;
    socketRef.current.emit("sendChatMessage", text);
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
              const isAdminMessage = message.senderId === session?.user?.userId;
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
                    <span>{isAdminMessage ? "Admin" : "Participant"}</span>
                  </div>
                  <p>{message.text}</p>
                  <time className="text-xs text-gray-500">
                    {new Date(message.time).toLocaleString()}
                  </time>
                </div>
              );
            })}
          </div>
          {chatlog?.status === "active" && (
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
          )}
          {chatlog?.status === "archived" && (
            <p className="mt-4 text-sm text-gray-600">
              This ride has ended. The chat is read-only.
            </p>
          )}
        </>
      )}
    </section>
  );
}
