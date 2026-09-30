"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { io, type Socket } from "socket.io-client";
import { ToastContainer, toast } from "react-toast";

type ToastNotification = {
  type: "success" | "error" | "info" | "warn";
  message: string;
};

export default function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const accessToken = session?.user?.accessToken;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!accessToken || !wsUrl || socketRef.current) return;

    const socket = io(`${wsUrl}/notifications`, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: 20,
    });
    socketRef.current = socket;

    socket.on("notification", ({ type, message }: ToastNotification) => {
      toast[type](message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [session?.user?.accessToken]);

  return (
    <>
      <ToastContainer position="top-right" />
      {children}
    </>
  );
}
