"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";

export default function SocketTest() {
  useEffect(() => {
    const socket = io("http://127.0.0.1:4000", {
      auth: {
        routeId: "66d3f0e4c9e8c4e8f6d8a321",
        userId: "66d3f0e4c9e8c4e8f6d8a555",
      },
      transports: ["websocket", "polling"],
    });

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

    socket.on("connect_error", (err: any) => {
      console.error("Connection error:", err.message);
      console.error(err.description);
      console.error(err.context);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return <div>Socket Test Page (check console)</div>;
}
