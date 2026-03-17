"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";

function getAuthToken() {
  const cookies = document.cookie.split("; ");
  const prod = cookies.find((cookie) =>
    cookie.startsWith("__Secure-authjs.session-token="),
  );
  const dev = cookies.find((cookie) =>
    cookie.startsWith("authjs.session-token="),
  );
  const cookie = prod ?? dev;
  return cookie?.split("=")[1];
}

export default function SocketTest() {
  useEffect(() => {
    const token = getAuthToken();

    const socket = io("http://127.0.0.1:4000", {
      auth: {
        routeId: "YOUR_ROUTE_ID",
        token,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- socket.io connect_error shape varies at runtime
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
