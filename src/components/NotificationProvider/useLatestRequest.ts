"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Guards against out-of-order responses when the same fetch can overlap
 * (e.g. a real-time refresh firing while the initial load is in flight).
 *
 * Call `begin()` when a request starts; the returned `isLatest()` is false
 * once a newer request has begun or the component has unmounted, so the
 * caller should drop its result instead of writing state.
 */
export function useLatestRequest() {
  const latestRef = useRef(0);

  useEffect(
    () => () => {
      latestRef.current++;
    },
    [],
  );

  return useCallback(() => {
    const id = ++latestRef.current;
    return () => id === latestRef.current;
  }, []);
}
