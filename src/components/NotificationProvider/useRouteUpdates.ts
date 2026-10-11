"use client";

import { useEffect, useRef } from "react";
import { useRealtimeSocket } from "./NotificationProvider";

export type RouteUpdate = { routeId: string; status: string };

const DEBOUNCE_MS = 300;

/**
 * Calls `onUpdate` when the server reports that a route changed, so the page
 * can refetch. Bursts of events are coalesced into one call, and the callback
 * also fires after the socket reconnects, since events sent while
 * disconnected are lost. Pass `routeId` to only react to one route.
 *
 * `onUpdate` doesn't need to be memoized — the latest one is always used.
 */
export function useRouteUpdates(
  onUpdate: () => void,
  options?: { routeId?: string | null },
) {
  const socket = useRealtimeSocket();
  const routeId = options?.routeId;
  // Passing `routeId: null` (not yet known) waits instead of matching all.
  const scoped = routeId !== undefined;
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  useEffect(() => {
    if (!socket) return;
    if (scoped && !routeId) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onUpdateRef.current(), DEBOUNCE_MS);
    };

    const handleRouteUpdated = (update: RouteUpdate) => {
      if (routeId && update.routeId !== routeId) return;
      schedule();
    };

    socket.on("routeUpdated", handleRouteUpdated);
    // Reconnection events come from the Socket.IO Manager (.io).
    socket.io.on("reconnect", schedule);

    return () => {
      clearTimeout(timer);
      socket.off("routeUpdated", handleRouteUpdated);
      socket.io.off("reconnect", schedule);
    };
  }, [socket, routeId, scoped]);
}
