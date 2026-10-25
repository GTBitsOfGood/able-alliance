"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { io, type Socket } from "socket.io-client";
import { ToastContainer, toast } from "react-toast";

type ToastNotification = {
  type: "success" | "error" | "info" | "warn";
  message: string;
};

// The per-user /notifications socket, shared so pages can listen for
// real-time data events (see useRouteUpdates). Null until connected.
const RealtimeSocketContext = createContext<Socket | null>(null);

export function useRealtimeSocket() {
  return useContext(RealtimeSocketContext);
}

export default function NotificationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const accessToken = session?.user?.accessToken;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!accessToken || !wsUrl) return;

    const newSocket = io(`${wsUrl}/notifications`, {
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: 20,
    });

    newSocket.on("notification", ({ type, message }: ToastNotification) => {
      toast[type](message);
    });

    // Publishing the socket from inside the effect is what lets consumers
    // subscribe; it is replaced whenever the access token changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
    };
  }, [session?.user?.accessToken]);

  return (
    <RealtimeSocketContext.Provider value={socket}>
      <ToastContainer position="top-right" />
      {children}
    </RealtimeSocketContext.Provider>
  );
}
