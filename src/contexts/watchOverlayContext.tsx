"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef } from "react";

type WatchOverlayContextValue = {
  /** Call once when playback begins; closes episode sheet if open. */
  notifyPlaybackStart: () => void;
};

const WatchOverlayContext = createContext<WatchOverlayContextValue | null>(null);

export function WatchOverlayProvider({
  onPlaybackStart,
  children,
}: {
  onPlaybackStart?: () => void;
  children: React.ReactNode;
}) {
  const firedRef = useRef(false);

  const notifyPlaybackStart = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onPlaybackStart?.();
  }, [onPlaybackStart]);

  const value = useMemo(
    () => ({ notifyPlaybackStart }),
    [notifyPlaybackStart]
  );

  return (
    <WatchOverlayContext.Provider value={value}>
      {children}
    </WatchOverlayContext.Provider>
  );
}

export function useWatchOverlay() {
  return useContext(WatchOverlayContext);
}
