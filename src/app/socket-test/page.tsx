"use client";

import { getSession } from "next-auth/react";
import { useEffect } from "react";
import { io } from "socket.io-client";

function getAuthToken() {
  console.log("COOKIES: " + document.cookie);
  const cookies = document.cookie.split("; ");
  const prod = cookies.find((cookie) =>
    cookie.startsWith("__Secure-authjs.session-token="),
  );
  const dev = cookies.find((cookie) =>
    cookie.startsWith("authjs.session-token="),
  );
  const cookie = prod ?? dev;
  return cookie;
  // return cookie?.split("=")[1];
}

export default function SocketTest() {
  useEffect(() => {
    // const token = getAuthToken();

    async function initSocket() {
      const session = await getSession();
      const token = session?.user.accessToken;
      console.log("Session:", session);
      // const token = "TEST_TOKEN";

      if (!token) {
        console.error("No auth token found");
        return;
      }

      const socket = io("http://127.0.0.1:4000", {
        auth: {
          routeId: "69cb14b4e612672be5d805dd",
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
      });

      return () => {
        socket.disconnect();
      };
    }

    initSocket();
  }, []);

  return <div>Socket Test Page (check console)</div>;
}
