"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";

export default function SocketTest() {
  useEffect(() => {
    const socket = io("http://localhost:3001", {
      auth: {
        routeId: "YOUR_ROUTE_ID",
        userId: "YOUR_USER_ID",
      },
    });

    socket.on("connect", () => {
      console.log("Connected:", socket.id);

      socket.emit("sendChatMessage", "Hello from Next.js");

      socket.emit("updateLocation", {
        latitude: 12.34,
        longitude: 56.78,
      });
    });

    socket.on("receiveChatMessage", (msg) => {
      console.log("Chat:", msg);
    });

    socket.on("broadcastLocation", (loc) => {
      console.log("Location:", loc);
    });

    socket.on("connect_error", (err) => {
      console.error("Connection error:", err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return <div>Socket Test Page (check console)</div>;
}