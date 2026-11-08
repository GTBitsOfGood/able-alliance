"use client";

import { RouteStatus } from "@db/generated/enums";

import {
  canStudentEditRide,
  studentEditDisabledReason,
  routeDisplayLabel,
  isRouteDelayed,
  isRideChatOpen,
} from "@/utils/route-status";
import { useState, useEffect, useCallback, useRef } from "react";
import { useWindowSize } from "react-use";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import mapboxgl from "mapbox-gl";
import {
  getDirectionsGeometry,
  getRouteLinePaint,
  type LineStringGeometry,
} from "@/utils/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import BogIcon from "@/components/BogIcon/BogIcon";
import BogButton from "@/components/BogButton/BogButton";
import ConfirmActionModal from "@/components/ConfirmActionModal/ConfirmActionModal";
import CancelScopeOptions, {
  type CancelScope,
} from "@/components/CancelScopeOptions/CancelScopeOptions";
import StopTime from "./StopTime";
import RideChat from "@/components/RideChat/RideChat";
import { mergeChatMessages } from "@/utils/chat";
import DriverRideActions from "../DriverRideActions";
import { getStudentStatusChipStyle } from "@/app/rides/RideCard";
import styles from "./styles.module.css";
import { useRouteUpdates } from "@/hooks/useRouteUpdates";
import { useLatestRequest } from "@/hooks/useLatestRequest";
import type {
  RouteDetailResponse as RouteData,
  ChatMessageResponse,
} from "@/types/api";
import DelayRideModal from "@/components/DelayRideModal/DelayRideModal";
import { withDelay } from "@/utils/dateEst";
import { toast } from "react-toast";

const CANCELLABLE_STATUSES = new Set<RouteStatus>([
  RouteStatus.Requested,
  RouteStatus.ActionRequiredByAdmin,
  RouteStatus.ActionRequiredByStudent,
  RouteStatus.Scheduled,
  RouteStatus.EnRoute,
  RouteStatus.Arrived,
]);

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

function getStudentId(student: RouteData["student"]): string {
  return student.id;
}

function getDriverName(driver: RouteData["driver"]): string | null {
  if (!driver) return null;
  return (
    `${driver.preferredName || driver.firstName} ${driver.lastName}`.trim() ||
    null
  );
}

function getDriverId(driver: RouteData["driver"]): string | null {
  return driver?.id ?? null;
}

export default function RideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { data: session, status: sessionStatus } = useSession();
  const { width: windowWidth } = useWindowSize();
  const isMobileLayout = windowWidth <= 768;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [routeId, setRouteId] = useState<string>("");
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // A failed background refresh keeps the ride visible and only shows this.
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingRide, setCancellingRide] = useState(false);
  const [cancelScope, setCancelScope] = useState<CancelScope>("single");

  // Chat state
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const socketIdentityRef = useRef<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  // map.loaded() is false whenever the camera is moving or tiles are loading,
  // and "load" fires only once, so track the initial load ourselves.
  const mapLoadedRef = useRef(false);
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
  const [messages, setMessages] = useState<ChatMessageResponse[]>([]);
  const [chatRevision, setChatRevision] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatHistoryError, setChatHistoryError] = useState<string | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Open the chat deep link once the ride is loaded and its chat is open.
  useEffect(() => {
    if (
      searchParams.get("chat") === "1" &&
      route &&
      isRideChatOpen(route.status)
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowChatModal(true);
    }
  }, [searchParams, route]);

  // Driver actions
  const [markingMissing, setMarkingMissing] = useState(false);
  const [missingError, setMissingError] = useState<string | null>(null);
  const [driverActionBusy, setDriverActionBusy] = useState(false);
  const [driverActionError, setDriverActionError] = useState<string | null>(
    null,
  );
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [showDropoffModal, setShowDropoffModal] = useState(false);
  const [showPickupModal, setShowPickupModal] = useState(false);
  const [showNoShowModal, setShowNoShowModal] = useState(false);

  // Student delay reporting
  const [delayActionBusy, setDelayActionBusy] = useState(false);
  const delayRequestPending = useRef(false);
  const [delayActionError, setDelayActionError] = useState<string | null>(null);
  const [showDelayModal, setShowDelayModal] = useState(false);

  // Extract ID from params
  useEffect(() => {
    params.then(({ id }) => {
      setRouteId(id);
    });
  }, [params]);

  const beginRequest = useLatestRequest();

  // Fetch route data. A `silent` (background) refresh that fails transiently
  // keeps the ride on screen; losing the ride or access to it still doesn't.
  const fetchRoute = useCallback(
    async (options?: { silent?: boolean }) => {
      if (
        !routeId ||
        sessionStatus !== "authenticated" ||
        !session?.user?.userId
      )
        return;
      const isLatest = beginRequest();
      let unavailable = false;

      try {
        const res = await fetch(`/api/routes/${routeId}`);

        if (!res.ok) {
          if (res.status === 404) {
            unavailable = true;
            throw new Error("Route not found");
          } else if (res.status === 403) {
            unavailable = true;
            throw new Error("You do not have access to this route");
          }
          throw new Error("Failed to fetch route");
        }

        const routeData: RouteData = await res.json();
        if (!isLatest()) return;

        unavailable = true;
        if (session.user.activeType === "Student") {
          const studentId = getStudentId(routeData.student);
          if (studentId !== session.user.userId) {
            throw new Error("You are not the student for this route");
          }
        } else if (session.user.activeType === "Driver") {
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
        setRefreshError(null);
      } catch (e) {
        if (!isLatest()) return;
        if (options?.silent && !unavailable) {
          setRefreshError(
            "Couldn't refresh this ride. Showing the last loaded details.",
          );
          return;
        }
        setError(e instanceof Error ? e.message : "Failed to fetch route");
        setRoute(null);
      } finally {
        if (isLatest()) setLoading(false);
      }
    },
    [routeId, session, sessionStatus, router, beginRequest],
  );

  useEffect(() => {
    // This effect starts an asynchronous API request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRoute();
  }, [fetchRoute]);

  // Refetch when this route changes elsewhere (status, driver, cancellation).
  useRouteUpdates(
    () => {
      void fetchRoute({ silent: true });
      setChatRevision((current) => current + 1);
    },
    { routeId },
  );

  // Fetch the persisted timeline on status changes, including the final event
  // after the ride's chat socket disconnects. Opening archived chats works too.
  useEffect(() => {
    if (!routeId || !route?.status || sessionStatus !== "authenticated") return;
    let cancelled = false;
    void fetch(`/api/routes/${routeId}/messages`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load ride chat history.");
        const history: ChatMessageResponse[] = await response.json();
        if (!cancelled) {
          setMessages((current) =>
            mergeChatMessages(
              current.filter((message) => message.routeId === routeId),
              history,
            ),
          );
          setChatHistoryError(null);
        }
      })
      .catch(() => {
        if (!cancelled)
          setChatHistoryError(
            "Unable to load ride chat history. Reopen the chat to retry.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [routeId, route?.status, sessionStatus, showChatModal, chatRevision]);

  // Initialize and update Mapbox map
  useEffect(() => {
    if (!route) {
      return;
    }

    const initializeMap = () => {
      let cancelled = false;
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const container = mapContainerRef.current;
      if (!container || !token) return;

      const pickup = route.pickup;
      const dropoff = route.dropoff;

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
          mapLoadedRef.current = true;
        });
      }

      const map = mapRef.current;
      const updateRouteLine = (geometry: LineStringGeometry | null) => {
        if (!geometry) {
          if (map.getLayer("ride-route-line")) {
            map.removeLayer("ride-route-line");
          }
          if (map.getSource("ride-route")) {
            map.removeSource("ride-route");
          }
          return;
        }

        const source = map.getSource("ride-route");
        if (source && "setData" in source) {
          source.setData({
            type: "Feature",
            properties: {},
            geometry,
          });
          return;
        }

        map.addSource("ride-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry,
          },
        });
        map.addLayer({
          id: "ride-route-line",
          type: "line",
          source: "ride-route",
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: getRouteLinePaint(map.getContainer()),
        });
      };

      const updateRoute = async () => {
        let routeGeometry: LineStringGeometry | null = null;
        try {
          routeGeometry = await getDirectionsGeometry(
            [pickup.longitude, pickup.latitude],
            [dropoff.longitude, dropoff.latitude],
            token,
            "driving",
          );
        } catch (error) {
          if (cancelled) return;
          console.warn("[mapbox] Unable to load ride route:", error);
        }
        if (cancelled) return;
        updateRouteLine(routeGeometry);
      };

      const updateMap = () => {
        if (cancelled) return;
        map.resize();
        fitToBounds(map);

        markerRefs.current.forEach((marker) => marker.remove());
        markerRefs.current = [];

        const pickupPinColor = "var(--color-map-pickup)";
        const dropoffPinColor = "var(--color-map-dropoff)";
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

        const pickupMarker = new mapboxgl.Marker({
          element: createCustomPin(`Pickup: ${pickup.name}`, pickupPinColor),
          anchor: "bottom",
        })
          .setLngLat(pickupLngLat)
          .addTo(map);
        markerRefs.current.push(pickupMarker);

        // If pickup/dropoff overlap, raise the dropoff pin one label-height above
        const dropoffMarker = new mapboxgl.Marker({
          element: createCustomPin(
            `Dropoff: ${dropoff.name}`,
            dropoffPinColor,
            overlap ? 50 : 0,
          ),
          anchor: "bottom",
        })
          .setLngLat(dropoffLngLat)
          .addTo(map);
        markerRefs.current.push(dropoffMarker);
        void updateRoute();
      };

      if (mapLoadedRef.current) updateMap();
      else map.once("load", updateMap);

      return () => {
        cancelled = true;
        map.off("load", updateMap);
      };
    };

    return initializeMap();
  }, [route]);

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
      mapLoadedRef.current = false;
    };
  }, []);

  // ── WebSocket lifecycle ─────────────────────────────────────────────────────
  //
  // Keep the connection across modal/status updates. Reconnect when the
  // authenticated user or active role changes; disconnect on unmount.
  //
  // Keep participant chat available for the full lifetime of an open ride,
  // regardless of its scheduled date. The server enforces terminal statuses.
  //
  useEffect(() => {
    const isDriver = session?.user?.activeType === "Driver";
    const isStudent = session?.user?.activeType === "Student";
    const identity = `${routeId}:${session?.user?.userId}:${session?.user?.activeType}:${session?.user?.accessToken}`;
    if (socketIdentityRef.current !== identity) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      socketIdentityRef.current = identity;
      setSocket(null);
      setChatInput("");
    }

    const shouldConnect =
      !!route &&
      isRideChatOpen(route.status) &&
      !!routeId &&
      !!session?.user?.accessToken &&
      (isDriver || isStudent);

    if (!shouldConnect) {
      if (route && !isRideChatOpen(route.status) && socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
      }
      return;
    }
    if (socketRef.current) return;

    if (!wsUrl) return;

    const newSocket = io(wsUrl, {
      auth: { routeId, token: session.user.accessToken },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: 20,
    });

    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      if (socketRef.current !== newSocket) return;
      setSocket(newSocket);
      setChatError(null);
    });

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

    // Reconnection events come from the Socket.IO Manager (.io), not the socket.
    newSocket.io.on("reconnect", () => setChatError(null));

    newSocket.io.on("reconnect_failed", () => {
      setChatError("Could not connect to chat. Please refresh the page.");
      socketRef.current = null;
      setSocket(null);
    });

    newSocket.on("chatHistory", (history: ChatMessageResponse[]) => {
      if (socketRef.current !== newSocket) return;
      setChatRevision((current) => current + 1);
      setMessages((current) =>
        mergeChatMessages(
          current.filter((message) => message.routeId === routeId),
          history,
        ),
      );
    });

    newSocket.on("routeClosed", () => {
      setChatError("This ride has ended. The chat is now read-only.");
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
    });

    newSocket.on("receiveChatMessage", (message: ChatMessageResponse) => {
      if (socketRef.current !== newSocket) return;
      setMessages((prev) => mergeChatMessages(prev, [message]));
    });

    newSocket.on(
      "broadcastLocation",
      (loc: { latitude: number; longitude: number }) => {
        setOtherPartyLocation(loc);
      },
    );

    newSocket.on("chatError", (msg: string) => toast.error(msg));
  }, [route, routeId, session, wsUrl]);

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

    const label = session?.user?.activeType === "Driver" ? "Student" : "Driver";
    const color =
      session?.user?.activeType === "Driver" ? "#ea580c" : "#16a34a";

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
  }, [otherPartyLocation, session?.user?.activeType]);

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
          (routeStatusRef.current === RouteStatus.EnRoute ||
            routeStatusRef.current === RouteStatus.Arrived) &&
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
    const identity = `${routeId}:${session?.user?.userId}:${session?.user?.activeType}:${session?.user?.accessToken}`;
    if (socketIdentityRef.current !== identity || !socket.connected) return;

    setSendingMessage(true);
    // Server broadcasts receiveChatMessage back to all room members including
    // the sender, so we don't optimistically add here — the echo is the add.
    socket.emit("sendChatMessage", chatInput.trim());
    setChatInput("");
    setChatError(null);
    setSendingMessage(false);
  }, [chatInput, socket, sendingMessage, routeId, session]);

  const handleCancelRide = useCallback(async () => {
    if (!routeId) return;
    setCancellingRide(true);
    try {
      const res = await fetch("/api/routes/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routeId, scope: cancelScope }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? res.statusText);
      }
      socketRef.current?.emit("closeRouteRoom");
      setShowCancelModal(false);
      router.push("/rides");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancellation failed.");
    } finally {
      setCancellingRide(false);
    }
  }, [routeId, router, cancelScope]);

  const handleDriverAction = useCallback(
    async (endpoint: string, errorMsg: string, terminal = false) => {
      if (!routeId) return false;
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
        beginRequest();
        setRoute(updated);
        if (terminal) socketRef.current?.emit("closeRouteRoom");
        return true;
      } catch (e) {
        setDriverActionError(e instanceof Error ? e.message : errorMsg);
        return false;
      } finally {
        setDriverActionBusy(false);
      }
    },
    [routeId, beginRequest],
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

  const handleArrive = useCallback(
    () => handleDriverAction("/api/routes/arrive", "Failed to mark arrival."),
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
    if (!routeId) return false;
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
      beginRequest();
      setRoute(updated);
      socketRef.current?.emit("closeRouteRoom");
      return true;
    } catch (e) {
      setMissingError(
        e instanceof Error ? e.message : "Failed to mark as missing.",
      );
      return false;
    } finally {
      setMarkingMissing(false);
    }
  }, [routeId, beginRequest]);

  const handleMarkDelay = useCallback(
    async (minutes: number) => {
      if (!routeId || delayRequestPending.current) return false;
      delayRequestPending.current = true;
      setDelayActionBusy(true);
      setDelayActionError(null);
      try {
        const res = await fetch("/api/routes/delay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ routeId, delayMinutes: minutes }),
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? res.statusText);
        }
        const updated: RouteData = await res.json();
        beginRequest();
        setRoute(updated);
        return true;
      } catch (e) {
        setDelayActionError(
          e instanceof Error ? e.message : "Failed to mark as delayed.",
        );
        return false;
      } finally {
        delayRequestPending.current = false;
        setDelayActionBusy(false);
      }
    },
    [routeId, beginRequest],
  );

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

  const refreshNotice = refreshError && (
    <p className={styles.refreshError} role="status">
      {refreshError}
    </p>
  );

  const pickupLocationName = route.pickup.name;
  const dropoffLocationName = route.dropoff.name;
  const driverName = getDriverName(route.driver);
  const hasDriver = !!driverName;

  const delayMinutes = route.delayMinutes ?? 0;
  const isDelayed = delayMinutes > 0;
  const scheduledPickup = new Date(route.scheduledPickupTime);
  const delayedPickup = withDelay(scheduledPickup, delayMinutes);

  const originalDropoff = route.estimatedDropoffTime
    ? new Date(route.estimatedDropoffTime)
    : null;
  const delayedDropoff = originalDropoff
    ? withDelay(originalDropoff, delayMinutes)
    : null;

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

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

  const statusChipStyle = getStudentStatusChipStyle(
    route.status,
    isRouteDelayed(route),
  );

  const chatModal = showChatModal && (
    <RideChat
      presentation="dialog"
      title={
        session?.user?.activeType === "Driver"
          ? `Chat with Student: ${route.student.preferredName || route.student.firstName} ${route.student.lastName}`
          : driverName
            ? `Chat with Driver: ${driverName}`
            : "Ride chat"
      }
      messages={messages}
      subtitle={`${pickupLocationName} → ${dropoffLocationName} · ${formatTime(scheduledPickup)}`}
      currentUserId={session?.user?.userId ?? ""}
      currentUserType={session?.user?.activeType ?? "Student"}
      studentId={route.student.id}
      driverId={route.driver?.id ?? null}
      input={chatInput}
      onInputChange={setChatInput}
      onSend={handleSendMessage}
      onClose={() => setShowChatModal(false)}
      connected={!!socket?.connected && !sendingMessage}
      readOnly={!isRideChatOpen(route.status)}
      error={chatHistoryError ?? chatError}
    />
  );

  // ── Driver view ────────────────────────────────────────────────────────────
  if (session?.user?.activeType === "Driver") {
    const studentObj = route.student;
    const studentName = studentObj
      ? `${studentObj.preferredName || studentObj.firstName} ${studentObj.lastName}`.trim()
      : "—";
    const accommodations =
      studentObj?.studentInfo?.accessibilityNeeds
        .map(({ label }) => label)
        .join(", ") || "—";
    const additionalComments = studentObj?.studentInfo?.notes || "—";

    return (
      <div className={styles.rideDetailPage}>
        {chatModal}
        <ConfirmActionModal
          open={showArrivalModal}
          onOpenChange={setShowArrivalModal}
          onConfirm={async () => {
            if (await handleArrive()) setShowArrivalModal(false);
          }}
          variant="primary"
          title="Arrived at Pickup"
          description={`I have arrived at ${pickupLocationName}. The student will be notified.`}
          confirmLabel="Confirm Arrival"
          confirmingLabel="Confirming…"
          cancelLabel="Cancel"
          confirming={driverActionBusy}
        >
          {driverActionError && <p role="alert">{driverActionError}</p>}
        </ConfirmActionModal>
        <ConfirmActionModal
          open={showDropoffModal}
          onOpenChange={setShowDropoffModal}
          onConfirm={async () => {
            if (await handleDropoffStudent()) setShowDropoffModal(false);
          }}
          variant="primary"
          title="Student Dropped Off"
          description={`I have dropped off ${studentName}. This will complete the ride.`}
          confirmLabel="Confirm Dropoff"
          confirmingLabel="Completing…"
          cancelLabel="Cancel"
          confirming={driverActionBusy}
        >
          {driverActionError && <p role="alert">{driverActionError}</p>}
        </ConfirmActionModal>
        <ConfirmActionModal
          open={showPickupModal}
          onOpenChange={setShowPickupModal}
          onConfirm={async () => {
            if (await handlePickupStudent()) setShowPickupModal(false);
          }}
          variant="primary"
          title="Student Picked Up"
          description={`I have picked up ${studentName}.`}
          confirmLabel="Confirm Pickup"
          confirmingLabel="Confirming…"
          cancelLabel="Cancel"
          confirming={driverActionBusy}
        >
          {driverActionError && <p role="alert">{driverActionError}</p>}
        </ConfirmActionModal>
        <ConfirmActionModal
          open={showNoShowModal}
          onOpenChange={setShowNoShowModal}
          onConfirm={async () => {
            if (await handleMarkMissing()) setShowNoShowModal(false);
          }}
          variant="destructive"
          title="Student No-Show"
          description={`${studentName} did not show up for their ride.`}
          confirmLabel="Confirm No-Show"
          confirmingLabel="Marking…"
          cancelLabel="Cancel"
          confirming={markingMissing}
        >
          {missingError && <p role="alert">{missingError}</p>}
        </ConfirmActionModal>

        <main className={styles.main}>
          <header className={styles.header}>
            <Link href="/rides" className={styles.backLink}>
              <BogIcon name="arrow-left" size={20} />
              <span>Back to rides</span>
            </Link>
          </header>
          {refreshNotice}

          <div className={styles.titleRow}>
            <h1 className={styles.pageTitle}>Ride Details</h1>
            <span className={styles.statusChip} style={statusChipStyle}>
              {routeDisplayLabel(route)}
            </span>
          </div>

          <div className={styles.rideSummaryCard}>
            <p className={styles.rideDateLabel}>
              {formatDateLabel(scheduledPickup)}
            </p>
            <div className={styles.pickupDropoffRow}>
              <div className={styles.stopBlock}>
                <span className={styles.stopLabel}>Pickup</span>
                <StopTime
                  time={formatTime(delayedPickup)}
                  originalTime={
                    isDelayed ? formatTime(scheduledPickup) : undefined
                  }
                />
                <span className={styles.stopLocation}>
                  {pickupLocationName}
                </span>
              </div>
              <div className={styles.stopDivider} />
              <div className={`${styles.stopBlock} ${styles.stopBlockRight}`}>
                <span className={styles.stopLabel}>Dropoff</span>
                <StopTime
                  time={delayedDropoff ? formatTime(delayedDropoff) : "N/A"}
                  originalTime={
                    isDelayed && originalDropoff
                      ? formatTime(originalDropoff)
                      : undefined
                  }
                />

                <span className={styles.stopLocationRight}>
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
                <button
                  type="button"
                  className={styles.chatButton}
                  onClick={() => setShowChatModal(true)}
                >
                  <BogIcon name="chats" size={18} />
                  <span>
                    {isRideChatOpen(route.status)
                      ? "Chat with student"
                      : "View ride chat"}
                  </span>
                </button>
              </div>

              <DriverRideActions
                status={route.status}
                busy={driverActionBusy}
                missingBusy={markingMissing}
                onAction={(action) => {
                  if (action.endpoint === "missing") {
                    setMissingError(null);
                    setShowNoShowModal(true);
                  } else {
                    setDriverActionError(null);
                    if (action.endpoint === "start") void handleStartRide();
                    else if (action.endpoint === "arrive")
                      setShowArrivalModal(true);
                    else if (action.endpoint === "pickup")
                      setShowPickupModal(true);
                    else setShowDropoffModal(true);
                  }
                }}
              />

              {(missingError || delayActionError || driverActionError) && (
                <p
                  style={{
                    color: "var(--color-status-red-text)",
                    fontSize: "1.4rem",
                    margin: 0,
                  }}
                >
                  {missingError || delayActionError || driverActionError}
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
      <ConfirmActionModal
        open={showCancelModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowCancelModal(false);
            setCancelScope("single");
          }
        }}
        onConfirm={() => void handleCancelRide()}
        variant="destructive"
        title="Cancel Ride?"
        description={
          route?.seriesId
            ? "This is a recurring ride. Which rides do you want to cancel?"
            : "Are you sure you want to cancel this ride?"
        }
        confirmLabel={cancelScope === "series" ? "Cancel rides" : "Cancel ride"}
        confirmingLabel="Cancelling…"
        cancelLabel="Nevermind"
        confirming={cancellingRide}
      >
        {route?.seriesId && (
          <CancelScopeOptions
            value={cancelScope}
            onChange={setCancelScope}
            disabled={cancellingRide}
          />
        )}
      </ConfirmActionModal>
      <DelayRideModal
        open={showDelayModal}
        onOpenChange={(open) => {
          setShowDelayModal(open);
          if (!open) {
            setDelayActionError(null);
          }
        }}
        onConfirm={async (minutes) => {
          const ok = await handleMarkDelay(minutes);
          if (ok) {
            setShowDelayModal(false);
          }
        }}
        currentDelayMinutes={delayMinutes}
        onCancelRide={() => {
          setShowDelayModal(false);
          setShowCancelModal(true);
        }}
        confirming={delayActionBusy}
        delayActionError={delayActionError ?? undefined}
      />
      <main className={styles.main}>
        <header className={styles.header}>
          <Link href="/rides" className={styles.backLink}>
            <BogIcon name="arrow-left" size={20} />
            <span>Back to rides</span>
          </Link>
        </header>
        {refreshNotice}

        {/* Title row */}
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>Ride Details</h1>
          <span className={styles.statusChip} style={statusChipStyle}>
            {routeDisplayLabel(route)}
          </span>
        </div>

        {/* Ride summary card — full width */}
        <div className={styles.rideSummaryCard}>
          <p className={styles.rideDateLabel}>
            {formatDateLabel(scheduledPickup)}
          </p>
          {isMobileLayout ? (
            <div className={styles.pickupDropoffStack}>
              <div className={styles.stopLabelsRow}>
                <span className={styles.stopLabel}>Pickup</span>
                <span className={styles.stopLabel}>Dropoff</span>
              </div>
              <div className={styles.stopTimesRow}>
                <div className={styles.stopTimeStack}>
                  <StopTime
                    time={formatTime(delayedPickup)}
                    originalTime={
                      isDelayed ? formatTime(scheduledPickup) : undefined
                    }
                  />
                </div>
                <div className={styles.stopDivider} aria-hidden />
                <div className={styles.stopTimeStack}>
                  <StopTime
                    time={delayedDropoff ? formatTime(delayedDropoff) : "N/A"}
                    originalTime={
                      isDelayed && originalDropoff
                        ? formatTime(originalDropoff)
                        : undefined
                    }
                  />
                </div>
              </div>
              <div className={styles.stopLocationsRow}>
                <span className={styles.stopLocation}>
                  {pickupLocationName}
                </span>
                <span className={styles.stopLocationRight}>
                  {dropoffLocationName}
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.pickupDropoffRow}>
              <div className={styles.stopBlock}>
                <span className={styles.stopLabel}>Pickup</span>
                <div className={styles.stopTimeStack}>
                  <StopTime
                    time={formatTime(delayedPickup)}
                    originalTime={
                      isDelayed ? formatTime(scheduledPickup) : undefined
                    }
                  />
                </div>
                <span className={styles.stopLocation}>
                  {pickupLocationName}
                </span>
              </div>
              <div className={styles.stopDivider} />
              <div className={`${styles.stopBlock} ${styles.stopBlockRight}`}>
                <span className={styles.stopLabel}>Dropoff</span>
                <StopTime
                  time={delayedDropoff ? formatTime(delayedDropoff) : "N/A"}
                  originalTime={
                    isDelayed && originalDropoff
                      ? formatTime(originalDropoff)
                      : undefined
                  }
                />

                <span className={styles.stopLocationRight}>
                  {dropoffLocationName}
                </span>
              </div>
            </div>
          )}
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
              onClick={() => setShowChatModal(true)}
            >
              <BogIcon name="chats" size={18} />
              <span>
                {isRideChatOpen(route.status)
                  ? "Chat with driver"
                  : "View ride chat"}
              </span>
            </button>

            <button
              type="button"
              className={styles.editButton}
              disabled={!canStudentEditRide(route)}
              title={studentEditDisabledReason(route)}
              onClick={() => router.push(`/rides/${route.id}/edit`)}
            >
              Edit ride
            </button>

            {route.status === RouteStatus.ActionRequiredByStudent && (
              <Link
                href={`/rides/${route.id}/review`}
                className={styles.editButton}
              >
                Review changes
              </Link>
            )}
            {route.status === RouteStatus.ActionRequiredByAdmin && (
              <p>Your ride changes are awaiting administrator approval.</p>
            )}

            {(route.status === RouteStatus.Scheduled ||
              route.status === RouteStatus.EnRoute) && (
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => setShowDelayModal(true)}
                disabled={delayActionBusy || cancellingRide}
              >
                {delayActionBusy ? "Delaying…" : "Delay ride"}
              </button>
            )}

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

      {chatModal}
    </div>
  );
}
