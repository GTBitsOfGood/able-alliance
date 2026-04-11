"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import BogIcon from "@/components/BogIcon/BogIcon";
import BogButton from "@/components/BogButton/BogButton";
import { CancelRideModal } from "../CancelRideModal";
import styles from "./styles.module.css";

const CANCELLABLE_STATUSES = new Set(["Requested", "Scheduled"]);

type RouteUser = {
  _id: string;
  firstName: string;
  lastName: string;
  studentInfo?: {
    accessibilityNeeds?: string[];
    notes?: string;
  };
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
  estimatedDropoffTime?: string;
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

function createCustomPin(
  labelText: string,
  color: string,
  extraStemPx = 0,
): HTMLDivElement {
  const root = document.createElement("div");
  root.className = styles.mapPinRoot;
  root.style.setProperty("--pin-color", color);

  const label = document.createElement("div");
  label.textContent = labelText;
  label.className = styles.mapPinLabel;

  const stem = document.createElement("div");
  stem.className = styles.mapPinStem;
  if (extraStemPx > 0) {
    stem.style.height = `calc(2.2rem + ${extraStemPx}px)`;
  }

  const dot = document.createElement("div");
  dot.className = styles.mapPinDot;

  root.appendChild(label);
  root.appendChild(stem);
  root.appendChild(dot);
  return root;
}

/** Returns true when two [lng, lat] pairs are close enough to visually overlap. */
function coordsOverlap(
  a: [number, number],
  b: [number, number],
  thresholdDeg = 0.0003,
): boolean {
  return (
    Math.abs(a[0] - b[0]) < thresholdDeg && Math.abs(a[1] - b[1]) < thresholdDeg
  );
}

function isToday(iso: string): boolean {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { timeZone: "America/New_York" });
  return fmt(new Date(iso)) === fmt(new Date());
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [routeId, setRouteId] = useState<string>("");
  const [route, setRoute] = useState<RouteData | null>(null);
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingRide, setCancellingRide] = useState(false);

  // Chat state
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRefs = useRef<mapboxgl.Marker[]>([]);
  const otherPartyMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const selfMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const staticCoordsRef = useRef<[number, number][]>([]);
  const watchIdRef = useRef<number | null>(null);
  const routeStatusRef = useRef<string | undefined>(undefined);
  const [otherPartyLocation, setOtherPartyLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [selfLocation, setSelfLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isChatEligible, setIsChatEligible] = useState(false);

  // Auto-open chat if ?chat=1
  useEffect(() => {
    if (searchParams.get("chat") === "1" && isChatEligible && route) {
      setShowChatModal(true);
    }
  }, [searchParams, isChatEligible, route]);

  // Driver-specific state
  const [markingMissing, setMarkingMissing] = useState(false);
  const [missingError, setMissingError] = useState<string | null>(null);
  const [driverActionBusy, setDriverActionBusy] = useState(false);
  const [driverActionError, setDriverActionError] = useState<string | null>(
    null,
  );

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

        if (session.user.type === "Student") {
          const studentId = getStudentId(routeData.student);
          if (studentId !== session.user.userId) {
            throw new Error("You are not the student for this route");
          }
        } else if (session.user.type === "Driver") {
          const driverId = getDriverId(routeData.driver);
          if (driverId !== session.user.userId) {
            router.push("/rides");
            return;
          }
        } else {
          throw new Error("Unauthorized");
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
  }, [routeId, session, sessionStatus, router]);

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

      // Get location coordinates from the locations object (fetched from API)
      const pickupLocationName = locations[route.pickupLocation] || "Pickup";
      const dropoffLocationName = locations[route.dropoffLocation] || "Dropoff";

      // Default GT campus coordinates for fallback
      const defaultPickup = { latitude: 33.7756, longitude: -84.4027 };
      const defaultDropoff = { latitude: 33.7767, longitude: -84.3891 };

      const pickup = {
        name: pickupLocationName,
        latitude: defaultPickup.latitude,
        longitude: defaultPickup.longitude,
      };

      const dropoff = {
        name: dropoffLocationName,
        latitude: defaultDropoff.latitude,
        longitude: defaultDropoff.longitude,
      };

      const defaultCenter: [number, number] = [-84.3988077, 33.7760948];

      const fitToBounds = (map: mapboxgl.Map) => {
        const bounds = new mapboxgl.LngLatBounds(
          [pickup.longitude, pickup.latitude],
          [dropoff.longitude, dropoff.latitude],
        );
        map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 0 });
      };

      mapboxgl.accessToken = token;
      if (!mapRef.current) {
        mapRef.current = new mapboxgl.Map({
          container,
          style: "mapbox://styles/mapbox/streets-v12",
          center: defaultCenter,
          zoom: 13,
        });
        mapRef.current.on("load", () => {
          mapRef.current?.resize();
          fitToBounds(mapRef.current!);
        });
      } else {
        fitToBounds(mapRef.current);
      }

      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];

      const pinColor = "#183777";
      const pickupLngLat: [number, number] = [
        pickup.longitude,
        pickup.latitude,
      ];
      const dropoffLngLat: [number, number] = [
        dropoff.longitude,
        dropoff.latitude,
      ];
      const overlap = coordsOverlap(pickupLngLat, dropoffLngLat);

      // Store static pin coords so the self-marker effect can check for overlap
      staticCoordsRef.current = [pickupLngLat, dropoffLngLat];

      if (pickup && mapRef.current) {
        const pickupMarker = new mapboxgl.Marker({
          element: createCustomPin(`Pickup: ${pickup.name}`, pinColor),
          anchor: "bottom",
        })
          .setLngLat(pickupLngLat)
          .addTo(mapRef.current);
        markerRefs.current.push(pickupMarker);
      }

      if (dropoff && mapRef.current) {
        // If pickup/dropoff overlap, raise the dropoff pin one label-height above
        const dropoffMarker = new mapboxgl.Marker({
          element: createCustomPin(
            `Dropoff: ${dropoff.name}`,
            pinColor,
            overlap ? 50 : 0,
          ),
          anchor: "bottom",
        })
          .setLngLat(dropoffLngLat)
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
      otherPartyMarkerRef.current?.remove();
      otherPartyMarkerRef.current = null;
      selfMarkerRef.current?.remove();
      selfMarkerRef.current = null;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
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

  // ── WebSocket lifecycle ─────────────────────────────────────────────────────
  //
  // Single connection effect.  Intentionally returns no cleanup function so
  // the socket stays alive across status / modal changes — the unmount effect
  // below is the only place that actually disconnects.
  //
  // Connection is established when:
  //   • Driver: isChatEligible (ride is today)
  //   • Student: isChatEligible AND (status is En-route OR chat modal is open)
  //
  useEffect(() => {
    const isDriver = session?.user?.type === "Driver";
    const isStudent = session?.user?.type === "Student";

    const shouldConnect =
      isChatEligible &&
      !!routeId &&
      !!session?.user?.accessToken &&
      (isDriver ||
        (isStudent &&
          ![
            "Missing",
            "Completed",
            "Cancelled by Student",
            "Cancelled by Admin",
          ].includes(route?.status ?? "") &&
          (route?.status === "En-route" || showChatModal)));

    if (!shouldConnect || socketRef.current) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
    if (!wsUrl) {
      setChatError("WebSocket server URL not configured");
      return;
    }

    const newSocket = io(wsUrl, {
      auth: { routeId, token: session.user.accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: 20,
    });

    // Single source of truth: ref is set immediately, state follows
    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on("connect", () => setChatError(null));

    newSocket.on("disconnect", (reason) => {
      // "io server disconnect" = server explicitly closed the connection.
      // All other reasons (transport error, ping timeout, etc.) are handled
      // by Socket.IO's built-in reconnection — don't touch the ref here.
      if (reason === "io server disconnect") {
        socketRef.current = null;
        setSocket(null);
      }
    });

    // Don't call disconnect() here — doing so cancels Socket.IO's own
    // reconnection logic.  Just surface the error and let it retry.
    newSocket.on("connect_error", () => {
      setChatError("Connection issue — retrying…");
    });

    newSocket.on("reconnect", () => setChatError(null));

    newSocket.on("reconnect_failed", () => {
      setChatError("Could not connect to chat. Please refresh the page.");
      socketRef.current = null;
      setSocket(null);
    });

    // Server sends { senderType, text, time } objects
    const userType = session.user.type;
    newSocket.on(
      "chatHistory",
      (history: { senderType: string; text: string; time: string }[]) => {
        setMessages(
          history.map((m) => ({
            sender: m.senderType === userType.toLowerCase() ? "user" : "other",
            text: m.text,
            timestamp: new Date(m.time),
          })),
        );
      },
    );

    newSocket.on(
      "receiveChatMessage",
      (message: { senderType: string; text: string; time: string }) => {
        setMessages((prev) => [
          ...prev,
          {
            sender:
              message.senderType === userType.toLowerCase() ? "user" : "other",
            text: message.text,
            timestamp: new Date(message.time),
          },
        ]);
      },
    );

    newSocket.on(
      "broadcastLocation",
      (loc: { latitude: number; longitude: number }) => {
        setOtherPartyLocation(loc);
      },
    );

    newSocket.on("chatError", (msg: string) => setChatError(msg));
  }, [isChatEligible, route?.status, routeId, session, showChatModal]);

  // Disconnect only on unmount — not on dep changes
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // Keep routeStatusRef in sync so watchPosition callback can read it without a stale closure
  useEffect(() => {
    routeStatusRef.current = route?.status;
  }, [route?.status]);

  // Show other party's live location on the map
  useEffect(() => {
    if (!otherPartyLocation || !mapRef.current) return;

    const label = session?.user?.type === "Driver" ? "Student" : "Driver";
    const color = session?.user?.type === "Driver" ? "#ea580c" : "#16a34a";

    if (!otherPartyMarkerRef.current) {
      otherPartyMarkerRef.current = new mapboxgl.Marker({
        element: createCustomPin(label, color),
        anchor: "bottom",
      })
        .setLngLat([otherPartyLocation.longitude, otherPartyLocation.latitude])
        .addTo(mapRef.current);
    } else {
      otherPartyMarkerRef.current.setLngLat([
        otherPartyLocation.longitude,
        otherPartyLocation.latitude,
      ]);
    }

    mapRef.current.panTo(
      [otherPartyLocation.longitude, otherPartyLocation.latitude],
      { duration: 800 },
    );
  }, [otherPartyLocation, session?.user?.type]);

  // Watch own GPS position — updates selfLocation state and emits location to socket when En-route
  useEffect(() => {
    if (!navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setSelfLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (
          routeStatusRef.current === "En-route" &&
          socketRef.current?.connected
        ) {
          socketRef.current.emit("updateLocation", {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
        }
      },
      () => {
        // Permission denied or unavailable — no pin shown
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  // Place/update "You" dot on the map as self location changes
  useEffect(() => {
    if (!selfLocation || !mapRef.current) return;

    const selfLngLat: [number, number] = [
      selfLocation.longitude,
      selfLocation.latitude,
    ];

    if (!selfMarkerRef.current) {
      const dot = document.createElement("div");
      dot.style.cssText =
        "width:16px;height:16px;border-radius:50%;background:#2563eb;" +
        "border:3px solid white;box-shadow:0 0 0 2px #2563eb,0 2px 8px rgba(0,0,0,.3);";
      selfMarkerRef.current = new mapboxgl.Marker({
        element: dot,
        anchor: "center",
      })
        .setLngLat(selfLngLat)
        .addTo(mapRef.current);
    } else {
      selfMarkerRef.current.setLngLat(selfLngLat);
    }
  }, [selfLocation]);

  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim() || !socket || sendingMessage) return;

    setSendingMessage(true);
    // Server broadcasts receiveChatMessage back to all room members including
    // the sender, so we don't optimistically add here — the echo is the add.
    socket.emit("sendChatMessage", chatInput.trim());
    setChatInput("");
    setChatError(null);
    setSendingMessage(false);
  }, [chatInput, socket, sendingMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCancelRide = useCallback(async () => {
    if (!routeId) return;
    setCancellingRide(true);
    try {
      const res = await fetch("/api/routes/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      socketRef.current?.emit("endRoute");
      setShowCancelModal(false);
      router.push("/rides");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancellation failed.");
    } finally {
      setCancellingRide(false);
    }
  }, [routeId, router]);

  const handleDriverAction = useCallback(
    async (endpoint: string, errorMsg: string, terminal = false) => {
      if (!routeId) return;
      setDriverActionBusy(true);
      setDriverActionError(null);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ routeId }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? res.statusText);
        }
        const updated: RouteData = await res.json();
        setRoute(updated);
        if (terminal) socketRef.current?.emit("endRoute");
      } catch (e) {
        setDriverActionError(e instanceof Error ? e.message : errorMsg);
      } finally {
        setDriverActionBusy(false);
      }
    },
    [routeId],
  );

  const handleStartRide = useCallback(
    () => handleDriverAction("/api/routes/start", "Failed to start ride."),
    [handleDriverAction],
  );

  const handlePickupStudent = useCallback(
    () =>
      handleDriverAction("/api/routes/pickup", "Failed to mark as picked up."),
    [handleDriverAction],
  );

  const handleDropoffStudent = useCallback(
    () =>
      handleDriverAction(
        "/api/routes/complete",
        "Failed to complete ride.",
        true,
      ),
    [handleDriverAction],
  );

  const handleMarkMissing = useCallback(async () => {
    if (!routeId) return;
    setMarkingMissing(true);
    setMissingError(null);
    try {
      const res = await fetch("/api/routes/missing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      const updated: RouteData = await res.json();
      setRoute(updated);
      socketRef.current?.emit("endRoute");
    } catch (e) {
      setMissingError(
        e instanceof Error ? e.message : "Failed to mark as missing.",
      );
    } finally {
      setMarkingMissing(false);
    }
  }, [routeId]);

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
  const hasDriver = !!driverName;

  const scheduledDate = new Date(route.scheduledPickupTime);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const dropoffTimeDisplay = route.estimatedDropoffTime
    ? formatTime(new Date(route.estimatedDropoffTime))
    : "N/A";

  const formatDateLabel = (d: Date) => {
    const tz = "America/New_York";
    const todayKey = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const dKey = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    if (dKey === todayKey) {
      return `Today, ${d.toLocaleDateString("en-US", { timeZone: tz, month: "long", day: "numeric" })}`;
    }
    return d.toLocaleDateString("en-US", {
      timeZone: tz,
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const statusChipStyle: React.CSSProperties = (() => {
    switch (route.status) {
      case "Scheduled":
        return { background: "#dbeafe", color: "#1e40af" };
      case "En-route":
      case "Pickedup":
        return { background: "#fef3c7", color: "#92400e" };
      case "Completed":
        return { background: "#d1fae5", color: "#065f46" };
      case "Cancelled by Student":
      case "Cancelled by Admin":
      case "Missing":
        return { background: "#fee2e2", color: "#991b1b" };
      default:
        return { background: "#1e293b", color: "#fff" };
    }
  })();

  // ── Driver view ────────────────────────────────────────────────────────────
  if (session?.user?.type === "Driver") {
    const studentObj =
      route.student && typeof route.student !== "string"
        ? (route.student as RouteUser)
        : null;
    const studentName = studentObj
      ? `${studentObj.firstName} ${studentObj.lastName}`.trim()
      : "—";
    const accommodations =
      studentObj?.studentInfo?.accessibilityNeeds?.join(", ") || "—";
    const additionalComments = studentObj?.studentInfo?.notes || "—";

    const chatModal = showChatModal && (
      <div
        className={styles.chatModalOverlay}
        onClick={() => setShowChatModal(false)}
      >
        <div className={styles.chatModal} onClick={(e) => e.stopPropagation()}>
          <div className={styles.chatModalHeader}>
            <h2 className={styles.chatModalTitle}>Chat with Student</h2>
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
            {messages.map((msg, idx) => {
              const isUser = msg.sender === "user";
              const prevIsOther =
                !isUser && idx > 0 && messages[idx - 1].sender === "other";
              return (
                <div
                  key={idx}
                  className={`${styles.messageRow} ${
                    isUser ? styles.messageRowUser : styles.messageRowOther
                  }`}
                >
                  {!isUser &&
                    (prevIsOther ? (
                      <div className={styles.messageAvatarSpacer} />
                    ) : (
                      <div className={styles.messageAvatar}>
                        <BogIcon name="user" size={18} />
                      </div>
                    ))}
                  <div className={styles.messageBubble}>
                    <p className={styles.messageText}>{msg.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className={styles.chatInputContainer}>
            <input
              type="text"
              className={styles.chatInput}
              placeholder="Type a message..."
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
              <BogIcon name="arrow-right" size={18} />
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <div className={styles.rideDetailPage}>
        {chatModal}
        <main className={styles.main}>
          <header className={styles.header}>
            <Link href="/rides" className={styles.backLink}>
              <BogIcon name="arrow-left" size={20} />
              <span>Back to rides</span>
            </Link>
          </header>

          <div className={styles.titleRow}>
            <h1 className={styles.pageTitle}>Ride Details</h1>
            <span className={styles.statusChip} style={statusChipStyle}>
              {route.status}
            </span>
          </div>

          <div className={styles.rideSummaryCard}>
            <p className={styles.rideDateLabel}>
              {formatDateLabel(scheduledDate)}
            </p>
            <div className={styles.pickupDropoffRow}>
              <div className={styles.stopBlock}>
                <span className={styles.stopLabel}>Pickup</span>
                <span className={styles.stopTime}>
                  {formatTime(scheduledDate)}
                </span>
                <span className={styles.stopLocation}>
                  {pickupLocationName}
                </span>
              </div>
              <div className={styles.stopDivider} />
              <div className={`${styles.stopBlock} ${styles.stopBlockRight}`}>
                <span className={styles.stopLabel}>Dropoff</span>
                <span className={styles.stopTime}>{dropoffTimeDisplay}</span>
                <span className={styles.stopLocation}>
                  {dropoffLocationName}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.contentContainer}>
            {/* Left column — student info + actions */}
            <div className={styles.leftColumn}>
              <div className={styles.driverSection}>
                <h2 className={styles.sectionTitle}>Student Information</h2>
                <div className={styles.driverInfoGrid}>
                  <div className={styles.studentInfoItem}>
                    <span className={styles.studentInfoLabel}>Name</span>
                    <span className={styles.studentInfoValue}>
                      {studentName}
                    </span>
                  </div>
                  <div className={styles.studentInfoItem}>
                    <span className={styles.studentInfoLabel}>
                      Accommodations
                    </span>
                    <span className={styles.studentInfoValue}>
                      {accommodations}
                    </span>
                  </div>
                  <div className={styles.studentInfoItem}>
                    <span className={styles.studentInfoLabel}>
                      Additional Comments
                    </span>
                    <span className={styles.studentInfoValue}>
                      {additionalComments}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.chatButtonWrapper}>
                {!isChatEligible && (
                  <span className={styles.chatTooltip}>
                    Chat is only available on the day of the ride
                  </span>
                )}
                <button
                  type="button"
                  className={styles.chatButton}
                  onClick={() => isChatEligible && setShowChatModal(true)}
                  disabled={
                    !isChatEligible ||
                    [
                      "Pickedup",
                      "Completed",
                      "Missing",
                      "Cancelled by Student",
                      "Cancelled by Admin",
                    ].includes(route.status)
                  }
                >
                  <BogIcon name="chats" size={18} />
                  <span>Chat with student</span>
                </button>
              </div>

              {/* Scheduled: Start ride */}
              {route.status === "Scheduled" && (
                <button
                  type="button"
                  className={styles.startRideButton}
                  onClick={() => void handleStartRide()}
                  disabled={driverActionBusy}
                >
                  {driverActionBusy ? "Starting…" : "Start ride"}
                </button>
              )}

              {/* En-route: Student picked up + Student no-show */}
              {route.status === "En-route" && (
                <>
                  <button
                    type="button"
                    className={styles.greenOutlineButton}
                    onClick={() => void handlePickupStudent()}
                    disabled={driverActionBusy}
                  >
                    {driverActionBusy ? "Updating…" : "Student picked up"}
                  </button>
                  <button
                    type="button"
                    className={styles.cancelButton}
                    onClick={() => void handleMarkMissing()}
                    disabled={markingMissing}
                  >
                    {markingMissing ? "Marking…" : "Student no-show"}
                  </button>
                </>
              )}

              {/* Pickedup: Student dropped off */}
              {route.status === "Pickedup" && (
                <button
                  type="button"
                  className={styles.greenOutlineButton}
                  onClick={() => void handleDropoffStudent()}
                  disabled={driverActionBusy}
                >
                  {driverActionBusy ? "Completing…" : "Student dropped off"}
                </button>
              )}

              {(missingError || driverActionError) && (
                <p
                  style={{
                    color: "var(--color-status-red-text)",
                    fontSize: "1.4rem",
                    margin: 0,
                  }}
                >
                  {missingError || driverActionError}
                </p>
              )}
            </div>

            {/* Right column — map */}
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
      </div>
    );
  }
  // ── End driver view ─────────────────────────────────────────────────────────

  return (
    <div className={styles.rideDetailPage}>
      <CancelRideModal
        open={showCancelModal}
        onOpenChange={(open) => {
          if (!open) setShowCancelModal(false);
        }}
        onConfirmCancel={() => void handleCancelRide()}
        confirming={cancellingRide}
      />
      <main className={styles.main}>
        <header className={styles.header}>
          <Link href="/rides" className={styles.backLink}>
            <BogIcon name="arrow-left" size={20} />
            <span>Back to rides</span>
          </Link>
        </header>

        {/* Title row */}
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Ride Details</h1>
          <span className={styles.statusChip} style={statusChipStyle}>
            {route.status}
          </span>
        </div>

        {/* Ride summary card — full width */}
        <div className={styles.rideSummaryCard}>
          <p className={styles.rideDateLabel}>
            {formatDateLabel(scheduledDate)}
          </p>
          <div className={styles.pickupDropoffRow}>
            <div className={styles.stopBlock}>
              <span className={styles.stopLabel}>Pickup</span>
              <span className={styles.stopTime}>
                {formatTime(scheduledDate)}
              </span>
              <span className={styles.stopLocation}>{pickupLocationName}</span>
            </div>
            <div className={styles.stopDivider} />
            <div className={`${styles.stopBlock} ${styles.stopBlockRight}`}>
              <span className={styles.stopLabel}>Dropoff</span>
              <span className={styles.stopTime}>{dropoffTimeDisplay}</span>
              <span className={styles.stopLocation}>{dropoffLocationName}</span>
            </div>
          </div>
        </div>

        {/* Two-column: driver info + map */}
        <div className={styles.contentContainer}>
          {/* Left Column — Driver info */}
          <div className={styles.leftColumn}>
            <div className={styles.driverSection}>
              <div className={styles.driverSectionHeader}>
                <h2 className={styles.sectionTitle}>Driver Information</h2>
                {!hasDriver && (
                  <span className={styles.pendingChip}>Pending</span>
                )}
              </div>
              <div className={styles.driverInfoGrid}>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Vehicle ID</span>
                  <span className={styles.infoValue}>
                    {hasDriver ? route.vehicle?.name || "--" : "--"}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>License Plate</span>
                  <span className={styles.infoValue}>
                    {hasDriver ? route.vehicle?.licensePlate || "--" : "--"}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Description</span>
                  <span className={styles.infoValue}>
                    {hasDriver ? route.vehicle?.description || "--" : "--"}
                  </span>
                </div>
                <div className={styles.infoRow}>
                  <span className={styles.infoLabel}>Driver</span>
                  <span className={styles.infoValue}>{driverName || "--"}</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              className={styles.chatButton}
              onClick={() => isChatEligible && setShowChatModal(true)}
              disabled={
                !isChatEligible ||
                [
                  "Missing",
                  "Completed",
                  "Cancelled by Student",
                  "Cancelled by Admin",
                ].includes(route.status)
              }
            >
              <BogIcon name="chats" size={18} />
              <span>Chat with driver</span>
            </button>

            <button
              type="button"
              className={styles.editButton}
              onClick={() => {}}
            >
              Edit ride
            </button>

            {CANCELLABLE_STATUSES.has(route.status) && (
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setShowCancelModal(true)}
                disabled={cancellingRide}
              >
                {cancellingRide ? "Cancelling…" : "Cancel ride"}
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
              {messages.map((msg, idx) => {
                const isUser = msg.sender === "user";
                const prevIsOther =
                  !isUser && idx > 0 && messages[idx - 1].sender === "other";
                return (
                  <div
                    key={idx}
                    className={`${styles.messageRow} ${
                      isUser ? styles.messageRowUser : styles.messageRowOther
                    }`}
                  >
                    {!isUser &&
                      (prevIsOther ? (
                        <div className={styles.messageAvatarSpacer} />
                      ) : (
                        <div className={styles.messageAvatar}>
                          <BogIcon name="user" size={18} />
                        </div>
                      ))}
                    <div className={styles.messageBubble}>
                      <p className={styles.messageText}>{msg.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className={styles.chatInputContainer}>
              <input
                type="text"
                className={styles.chatInput}
                placeholder="Type a message..."
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
                <BogIcon name="arrow-right" size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
