"use client";

import { useEffect, useRef } from "react";
import { useRealtimeSocket } from "./NotificationProvider";

const DEBOUNCE_MS = 300;

/**
 * Calls `onUpdate` when the server reports that locations were created or
 * deleted, so the page can refetch. Bursts of events are coalesced into one
 * call, and the callback also fires whenever the socket (re)connects, since
 * events sent while not connected are lost.
 *
 * `onUpdate` doesn't need to be memoized — the latest one is always used.
 */
export function useLocationUpdates(
  onUpdate: () => void,
  options?: { enabled?: boolean },
) {
  const socket = useRealtimeSocket();
  const enabled = options?.enabled ?? true;
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  });

  useEffect(() => {
    if (!socket || !enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onUpdateRef.current(), DEBOUNCE_MS);
    };

    socket.on("locationsUpdated", schedule);
    socket.on("connect", schedule);

    return () => {
      clearTimeout(timer);
      socket.off("locationsUpdated", schedule);
      socket.off("connect", schedule);
    };
  }, [socket, enabled]);
}
