"use client";

import { getSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export default function SocketTest() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    async function initSocket() {
      const session = await getSession();
      console.log("Session:", session);
      console.log("Session user:", session?.user);
      const token = session?.user.accessToken;
      console.log(
        "Access token:",
        token ? `${token.slice(0, 20)}...` : "undefined",
      );

      if (!token) {
        console.error("No auth token found");
        return;
      }

      const res = await fetch("/api/routes");
      const routes = await res.json();

      if (!routes.length) {
        console.error("No routes found in DB");
        return;
      }

      const routeId = routes[0]._id;
      console.log(
        `Using route ID: ${routeId} with student ${routes[0].student._id} and driver ${routes[0].driver._id} for testing`,
      );

      const socket = io(
        process.env.NEXT_PUBLIC_WEBSOCKET_URL ?? "http://127.0.0.1:4000",
        {
          auth: {
            routeId,
            token,
          },
          transports: ["websocket", "polling"],
        },
      );

      socketRef.current = socket;

      socket.on("connect", () => {
        console.log("Connected:", socket.id);

        socket.emit("sendChatMessage", "Hello from Next.js");

        socket.emit("updateLocation", {
          latitude: 12.34,
          longitude: 56.78,
        });
      });

      socket.on("receiveChatMessage", (msg: string) => {
        console.log("Chat:", msg);
      });

      socket.on(
        "broadcastLocation",
        (loc: { latitude: number; longitude: number }) => {
          console.log("Location:", loc);
        },
      );

      socket.on("connect_error", (err: Error) => {
        console.error("Connection error:", err.message);
      });
    }

    initSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return <div>Socket Test Page (check console)</div>;
}
