"use client";

import { RouteStatus } from "@db/generated/enums";

import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

import type { ChatMessageResponse as ChatMessage } from "@/types/api";
import RideChat from "@/components/RideChat/RideChat";
import { isOwnChatMessage, mergeChatMessages } from "@/utils/chat";
import { useRouteUpdates } from "@/hooks/useRouteUpdates";
import RideStatusChip from "@/components/admin/RideStatusChip";

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
  presentation = "inline",
  onActivity,
}: {
  routeId: string;
  rideLabel: string;
  routeStatus: RouteStatus;
  studentId: string;
  driverId: string | null;
  onClose: () => void;
  presentation?: "inline" | "panel" | "dialog";
  onActivity?: () => void;
}) {
  const { data: session } = useSession();
  const [chatlog, setChatlog] = useState<Chatlog | null>(null);
  const [input, setInput] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [socketError, setSocketError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [revision, setRevision] = useState(0);
  const onActivityRef = useRef(onActivity);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  useRouteUpdates(() => setRevision((current) => current + 1), { routeId });

  useEffect(() => {
    let cancelled = false;

    const loadMessages = async () => {
      setLoadError(null);
      try {
        const response = await fetch(
          `/api/routes/${encodeURIComponent(routeId)}/messages`,
        );
        if (!response.ok)
          throw new Error("Unable to load this ride transcript.");
        const data = (await response.json()) as ChatMessage[];
        if (!cancelled) {
          setChatlog((current) => ({
            status: CLOSED_ROUTE_STATUSES.has(routeStatus)
              ? "archived"
              : "active",
            messages: mergeChatMessages(
              current?.messages.filter(
                (message) => message.routeId === routeId,
              ) ?? [],
              Array.isArray(data) ? data : [],
            ),
          }));
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
  }, [routeId, routeStatus, revision]);

  useEffect(() => {
    const token = session?.user?.accessToken;
    const userId = session?.user?.userId;
    const activeType = session?.user?.activeType;
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
      setRevision((current) => current + 1);
      setChatlog((current) =>
        current
          ? {
              ...current,
              messages: mergeChatMessages(current.messages, messages),
            }
          : { status: "active", messages },
      );
    });
    nextSocket.on("receiveChatMessage", (message: ChatMessage) => {
      onActivityRef.current?.();
      if (
        userId &&
        activeType &&
        isOwnChatMessage(message, userId, activeType)
      ) {
        setInput((currentInput) =>
          currentInput.trim() === message.text ? "" : currentInput,
        );
      }
      setChatlog((current) =>
        current
          ? {
              ...current,
              messages: mergeChatMessages(current.messages, [message]),
            }
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
    session?.user?.activeType,
    studentId,
    driverId,
  ]);

  const messages = useMemo(() => chatlog?.messages ?? [], [chatlog]);
  const sendMessage = () => {
    const text = input.trim();
    if (!text || !socketRef.current?.connected) return;
    socketRef.current.emit("sendChatMessage", text);
  };

  return (
    <RideChat
      presentation={presentation}
      title={presentation === "inline" ? "Ride chat" : rideLabel}
      subtitle={presentation === "inline" ? rideLabel : undefined}
      headerAccessory={
        presentation !== "inline" ? (
          <RideStatusChip status={routeStatus} />
        ) : undefined
      }
      messages={messages}
      currentUserId={session?.user?.userId ?? ""}
      currentUserType={session?.user?.activeType ?? "Admin"}
      studentId={studentId}
      driverId={driverId}
      input={input}
      onInputChange={setInput}
      onSend={sendMessage}
      onClose={onClose}
      connected={connected && !loadError}
      readOnly={
        CLOSED_ROUTE_STATUSES.has(routeStatus) || chatlog?.status === "archived"
      }
      loading={loading}
      error={loadError ?? socketError}
    />
  );
}
