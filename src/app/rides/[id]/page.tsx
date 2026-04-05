"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import BogButton from "@/components/BogButton/BogButton";
import BogIcon from "@/components/BogIcon/BogIcon";
import { RideCard } from "../RideCard";
import styles from "./styles.module.css";

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
  vehicle?: {
    _id: string;
    name: string;
    licensePlate: string;
    description?: string;
    accessibility: string;
    seatCount: number;
  };
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
  const { data: session, status: sessionStatus } = useSession();
  const [routeId, setRouteId] = useState<string>("");
  const [route, setRoute] = useState<RouteData | null>(null);
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);
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

  // Initialize and update Mapbox map
  useEffect(() => {
    if (!route || !locations[route.pickupLocation]) {
      return;
    }

    const initializeMap = async () => {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const container = mapContainerRef.current;
      if (!container || !token) return;

      const pickup = {
        name: locations[route.pickupLocation] || "Pickup",
        latitude: parseFloat((route as any).pickupLat) || 33.7756,
        longitude: parseFloat((route as any).pickupLng) || -84.4027,
      };

      const dropoff = {
        name: locations[route.dropoffLocation] || "Dropoff",
        latitude: parseFloat((route as any).dropoffLat) || 33.7767,
        longitude: parseFloat((route as any).dropoffLng) || -84.3891,
      };

      const defaultCenter: [number, number] = [-84.3988077, 33.7760948];
      const defaultZoom = 15;

      const center = (): [number, number] => {
        if (pickup && dropoff) {
          return [
            (pickup.longitude + dropoff.longitude) / 2,
            (pickup.latitude + dropoff.latitude) / 2,
          ];
        }
        if (pickup) return [pickup.longitude, pickup.latitude];
        if (dropoff) return [dropoff.longitude, dropoff.latitude];
        return defaultCenter;
      };

      mapboxgl.accessToken = token;
      if (!mapRef.current) {
        mapRef.current = new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/streets-v12",
          center: center(),
          zoom: defaultZoom,
        });
        mapRef.current.on("load", () => mapRef.current?.resize());
      } else {
        mapRef.current.flyTo({ center: center(), zoom: defaultZoom });
      }

      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];

      const createCustomPin = (
        labelText: string,
        color: string,
      ): HTMLDivElement => {
        const root = document.createElement("div");
        root.style.display = "flex";
        root.style.flexDirection = "column";
        root.style.alignItems = "center";
        root.style.gap = "0";

        const label = document.createElement("div");
        label.textContent = labelText;
        label.style.backgroundColor = color;
        label.style.color = "white";
        label.style.padding = "0.25rem 0.5rem";
        label.style.borderRadius = "0.25rem";
        label.style.fontSize = "0.75rem";
        label.style.fontWeight = "bold";
        label.style.whiteSpace = "nowrap";

        const stem = document.createElement("div");
        stem.style.width = "2px";
        stem.style.height = "0.5rem";
        stem.style.backgroundColor = color;

        const dot = document.createElement("div");
        dot.style.width = "0.75rem";
        dot.style.height = "0.75rem";
        dot.style.borderRadius = "50%";
        dot.style.backgroundColor = color;
        dot.style.border = "2px solid white";

        root.appendChild(label);
        root.appendChild(stem);
        root.appendChild(dot);
        return root;
      };

      if (pickup && mapRef.current) {
        const pickupMarker = new mapboxgl.Marker({
          element: createCustomPin(
            `Pick Up: ${pickup.name}`,
            "var(--color-status-blue-text)",
          ),
          anchor: "bottom",
        })
          .setLngLat([pickup.longitude, pickup.latitude])
          .addTo(mapRef.current);
        markerRefs.current.push(pickupMarker);
      }

      if (dropoff && mapRef.current) {
        const dropoffMarker = new mapboxgl.Marker({
          element: createCustomPin(
            `Drop Off: ${dropoff.name}`,
            "var(--color-status-red-text)",
          ),
          anchor: "bottom",
        })
          .setLngLat([dropoff.longitude, dropoff.latitude])
          .addTo(mapRef.current);
        markerRefs.current.push(dropoffMarker);
      }
    };

    initializeMap();
  }, [route, locations]);

  useEffect(() => {
    return () => {
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Fetch locations (original - keep for backward compatibility)
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
          }
        });

        newSocket.on("connect_error", (err: Error) => {
          if (isMounted) {
            setChatError(`Connection error: ${err.message}`);
          }
        });

        newSocket.on("disconnect", () => {
          // Socket disconnected
        });

        if (isMounted) {
          socketRef.current = newSocket;
          setSocket(newSocket);
        }
      } catch (e) {
        if (isMounted) {
          const errorMsg =
            e instanceof Error ? e.message : "Failed to connect to chat";
          setChatError(errorMsg);
        }
      }
    })();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
    };
  }, [showChatModal, route, routeId, session]);

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

        <div className={styles.contentContainer}>
          {/* Left Column */}
          <div className={styles.leftColumn}>
            {/* Ride Card */}
            <div className={styles.rideCardWrapper}>
              <RideCard route={route} locationIdToName={locations} />
            </div>

            {/* Driver Information */}
            <div className={styles.driverSection}>
              <h2 className={styles.sectionTitle}>Driver Information</h2>
              <div className={styles.driverInfoGrid}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Vehicle ID</span>
                  <span className={styles.infoValue}>
                    {route.vehicle?._id || "N/A"}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>License Plate</span>
                  <span className={styles.infoValue}>
                    {route.vehicle?.licensePlate || "N/A"}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Description</span>
                  <span className={styles.infoValue}>
                    {route.vehicle?.description || "N/A"}
                  </span>
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
          </div>

          {/* Right Column - Map */}
          <div className={styles.rightColumn}>
            <div className={styles.mapContainer}>
              <div
                ref={mapContainerRef}
                className={styles.mapImage}
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "0.5rem",
                }}
              />
            </div>
          </div>
        </div>
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
                onKeyDown={handleKeyDown}
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
