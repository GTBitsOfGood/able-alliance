"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BogButton from "@/components/BogButton/BogButton";
import BogIcon from "@/components/BogIcon/BogIcon";
import BogChip from "@/components/BogChip/BogChip";
import { RideCard } from "../RideCard";
import styles from "./styles.module.css";

type Socket = any;

type RouteUser = {
  _id: string;
  firstName: string;
  lastName: string;
};

type RouteData = {
  _id: string;
  pickupLocation: string;
  dropoffLocation: string;
  student: string | RouteUser;
  driver?: string | RouteUser;
  vehicle?: string;
  scheduledPickupTime: string;
  status: string;
};

type Location = {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
};

type ChatMessage = {
  sender: "user" | "other";
  text: string;
  timestamp: Date;
};

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function getStatusChipColor(
  status: string,
): "green" | "red" | "amber" | "blue" | "gray" {
  switch (status) {
    case "Completed":
      return "green";
    case "Cancelled by Driver":
    case "Cancelled by Student":
    case "Cancelled by Admin":
    case "Missing":
      return "red";
    case "Requested":
    case "Scheduled":
      return "blue";
    case "En-route":
    case "Pickedup":
      return "amber";
    default:
      return "gray";
  }
}

function getStudentId(student: string | RouteUser): string {
  if (typeof student === "string") return student;
  return student._id;
}

function getStudentName(student: string | RouteUser): string | null {
  if (typeof student === "string") return null;
  return `${student.firstName} ${student.lastName}`.trim() || null;
}

function getDriverName(driver: string | RouteUser | undefined): string | null {
  if (!driver) return null;
  if (typeof driver === "string") return null;
  return `${driver.firstName} ${driver.lastName}`.trim() || null;
}

function getDriverId(driver: string | RouteUser | undefined): string | null {
  if (!driver) return null;
  if (typeof driver === "string") return driver;
  return driver._id;
}

export default function RideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const [routeId, setRouteId] = useState<string>("");
  const [route, setRoute] = useState<RouteData | null>(null);
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isChatEligible, setIsChatEligible] = useState(false);

  // Extract ID from params
  useEffect(() => {
    params.then(({ id }) => {
      setRouteId(id);
    });
  }, [params]);

  // Fetch route data
  useEffect(() => {
    if (!routeId || sessionStatus !== "authenticated" || !session?.user?.userId)
      return;

    const fetchRoute = async () => {
      try {
        const res = await fetch(`/api/routes/${routeId}`);

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error("Route not found");
          } else if (res.status === 403) {
            throw new Error("You do not have access to this route");
          }
          throw new Error("Failed to fetch route");
        }

        const routeData: RouteData = await res.json();

        // Check if current user is the student
        const studentId = getStudentId(routeData.student);
        if (studentId !== session.user.userId) {
          throw new Error("You are not the student for this route");
        }

        // Only show student view (driver view is handled separately)
        if (session.user.type !== "Student") {
          throw new Error("Only students can view this page");
        }

        setRoute(routeData);
        setError(null);

        // Determine if chat is eligible (ride is today)
        const chatEligible = isToday(routeData.scheduledPickupTime);
        setIsChatEligible(chatEligible);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch route");
        setRoute(null);
      } finally {
        setLoading(false);
      }
    };

    fetchRoute();
  }, [routeId, session, sessionStatus]);

  // Fetch locations
  useEffect(() => {
    if (!route) return;

    const fetchLocations = async () => {
      try {
        const res = await fetch("/api/locations");
        if (!res.ok) throw new Error("Failed to fetch locations");
        const locationsData: Location[] = await res.json();
        const locationMap: Record<string, string> = {};
        for (const loc of locationsData) {
          locationMap[loc._id] = loc.name;
        }
        setLocations(locationMap);
      } catch (e) {
        console.error("Failed to fetch locations:", e);
      }
    };

    fetchLocations();
  }, [route]);

  // WebSocket connection for chat
  useEffect(() => {
    if (!showChatModal || !route || !routeId || !session?.user?.userId) {
      return;
    }

    if (socket) {
      return;
    }

    let isMounted = true;

    (async () => {
      try {
        // Dynamic import of socket.io-client using require pattern
        let io: any;
        try {
          io =
            require("socket.io-client").default || require("socket.io-client");
        } catch {
          // Fallback if require fails - use dynamic import
          const socketIO = await import("socket.io-client");
          io = socketIO.default;
        }

        if (!isMounted) return;

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
        if (!wsUrl) {
          setChatError("WebSocket server URL not configured");
          return;
        }

        const newSocket = io(wsUrl, {
          auth: {
            routeId,
            userId: session.user.userId,
          },
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });

        if (!isMounted) {
          newSocket.disconnect();
          return;
        }

        newSocket.on("connect", () => {
          console.log("Connected to WebSocket server");
          if (isMounted) {
            setChatError(null);
          }
        });

        newSocket.on("receiveChatMessage", (message: string) => {
          if (isMounted) {
            const chatMessage: ChatMessage = {
              sender: "other",
              text: message,
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, chatMessage]);
          }
        });

        newSocket.on("chatError", (errorMessage: string) => {
          if (isMounted) {
            setChatError(errorMessage);
            console.error("Chat error:", errorMessage);
          }
        });

        newSocket.on("connect_error", (err: Error) => {
          if (isMounted) {
            setChatError(`Connection error: ${err.message}`);
            console.error("Connection error:", err);
          }
        });

        newSocket.on("disconnect", () => {
          console.log("Disconnected from WebSocket server");
        });

        if (isMounted) {
          setSocket(newSocket);
        }
      } catch (e) {
        if (isMounted) {
          const errorMsg =
            e instanceof Error ? e.message : "Failed to connect to chat";
          setChatError(errorMsg);
          console.error("Socket connection error:", e);
        }
      }
    })();

    return () => {
      isMounted = false;
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    };
  }, [showChatModal, route, routeId, session, socket]);

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || !socket || sendingMessage) return;

    setSendingMessage(true);
    try {
      const messageText = chatInput.trim();
      const chatMessage: ChatMessage = {
        sender: "user",
        text: messageText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, chatMessage]);

      // Emit the message to the server
      socket.emit("sendChatMessage", messageText);
      setChatInput("");
      setChatError(null);
    } catch (e) {
      const errorMsg =
        e instanceof Error ? e.message : "Failed to send message";
      setChatError(errorMsg);
    } finally {
      setSendingMessage(false);
    }
  }, [chatInput, socket, sendingMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (sessionStatus === "loading" || loading) {
    return (
      <div className={styles.rideDetailPage}>
        <main className={styles.main}>
          <p className={styles.loadingText}>Loading…</p>
        </main>
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className={styles.rideDetailPage}>
        <main className={styles.main}>
          <div className={styles.errorContainer}>
            <p className={styles.errorText}>
              {error || "Failed to load ride details"}
            </p>
            <Link href="/rides">
              <BogButton variant="primary" size="medium">
                Back to Rides
              </BogButton>
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const pickupLocationName =
    locations[route.pickupLocation] ?? route.pickupLocation;
  const dropoffLocationName =
    locations[route.dropoffLocation] ?? route.dropoffLocation;
  const driverName = getDriverName(route.driver);

  return (
    <div className={styles.rideDetailPage}>
      <main className={styles.main}>
        <header className={styles.header}>
          <Link href="/rides" className={styles.backLink}>
            <BogIcon name="arrow-left" size={20} />
            <span>Back to rides</span>
          </Link>
        </header>

        {/* Ride Card */}
        <div className={styles.rideCardWrapper}>
          <RideCard route={route} locationIdToName={locations} />
        </div>

        {/* Map */}
        <div className={styles.mapContainer}>
          <img
            src="/gt-campus-street.jpeg"
            alt="Route map"
            className={styles.mapImage}
          />
        </div>

        {/* Driver Information */}
        <div className={styles.driverSection}>
          <h2 className={styles.sectionTitle}>Driver Information</h2>
          <div className={styles.driverInfoGrid}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Vehicle ID</span>
              <span className={styles.infoValue}>1234</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>License Plate</span>
              <span className={styles.infoValue}>RVG1730</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Description</span>
              <span className={styles.infoValue}>Dodge</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Driver</span>
              <span className={styles.infoValue}>
                {driverName || "Unassigned"}
              </span>
            </div>
          </div>
        </div>

        {/* Chat Button */}
        {isChatEligible && (
          <button
            type="button"
            className={styles.chatButton}
            onClick={() => setShowChatModal(true)}
          >
            <BogIcon name="chats" size={18} />
            <span>Chat with driver</span>
          </button>
        )}
      </main>

      {/* Chat Modal */}
      {showChatModal && (
        <div
          className={styles.chatModalOverlay}
          onClick={() => setShowChatModal(false)}
        >
          <div
            className={styles.chatModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.chatModalHeader}>
              <h2 className={styles.chatModalTitle}>Chat with Driver</h2>
              <button
                type="button"
                className={styles.chatModalCloseButton}
                onClick={() => setShowChatModal(false)}
                aria-label="Close chat"
              >
                <BogIcon name="x" size={20} />
              </button>
            </div>

            {chatError && (
              <div className={styles.chatErrorBanner}>
                <p className={styles.chatErrorText}>{chatError}</p>
              </div>
            )}

            <div className={styles.messagesContainer}>
              {messages.length === 0 && (
                <div className={styles.noMessages}>
                  <p>No messages yet. Start the conversation!</p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`${styles.messageRow} ${
                    msg.sender === "user"
                      ? styles.messageRowUser
                      : styles.messageRowOther
                  }`}
                >
                  <div className={styles.messageBubble}>
                    <p className={styles.messageText}>{msg.text}</p>
                    <span className={styles.messageTime}>
                      {msg.timestamp.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.chatInputContainer}>
              <input
                type="text"
                className={styles.chatInput}
                placeholder="Type a message…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={!socket || sendingMessage}
              />
              <button
                type="button"
                className={styles.sendButton}
                onClick={handleSendMessage}
                disabled={!chatInput.trim() || !socket || sendingMessage}
                aria-label="Send message"
              >
                <BogIcon name="arrow-right" size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
