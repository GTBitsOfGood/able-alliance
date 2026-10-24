"use client";

import { useEffect, useRef } from "react";
import { useRealtimeSocket } from "./NotificationProvider";

export type RouteUpdate = { routeId: string; status: string };

/**
 * What changed since the last call: the IDs of the routes that were updated,
 * or `null` when the page should reload everything (after a (re)connect,
 * since events sent while not connected are lost).
 */
export type RouteChanges = { routeIds: string[] | null };

const DEBOUNCE_MS = 300;

/**
 * Calls `onUpdate` when the server reports that a route changed, so the page
 * can refetch. Bursts of events are coalesced into one call, and the callback
 * also fires whenever the socket (re)connects. Pass `routeId` to only react
 * to one route.
 *
 * `onUpdate` doesn't need to be memoized — the latest one is always used.
 */
export function useRouteUpdates(
  onUpdate: (changes: RouteChanges) => void,
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
    let pendingIds = new Set<string>();
    let reloadAll = false;

    const flush = () => {
      const changes = { routeIds: reloadAll ? null : [...pendingIds] };
      pendingIds = new Set();
      reloadAll = false;
      onUpdateRef.current(changes);
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(flush, DEBOUNCE_MS);
    };

    const handleRouteUpdated = (update: RouteUpdate) => {
      if (routeId && update.routeId !== routeId) return;
      pendingIds.add(update.routeId);
      schedule();
    };
    // The socket-level "connect" fires on the first connection and on every
    // reconnect, covering updates missed before the server joined our rooms.
    const handleConnect = () => {
      reloadAll = true;
      schedule();
    };

    socket.on("routeUpdated", handleRouteUpdated);
    socket.on("connect", handleConnect);

    return () => {
      clearTimeout(timer);
      socket.off("routeUpdated", handleRouteUpdated);
      socket.off("connect", handleConnect);
    };
  }, [socket, routeId, scoped]);
}
