"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { WatchPartyRoom } from "@/hooks/useWatchParty";

export type WatchPartyNavRegistration = {
  canPlay: boolean;
  room: WatchPartyRoom | null;
  isHost: boolean;
  loading: boolean;
  error: string;
  nickname: string;
  mediaType: "tv" | "movie";
  onCreate: (nickname: string) => void | Promise<string | null>;
  onJoin: (roomId: string, nickname: string) => void;
  onLeave: () => void;
  onSendChat: (text: string) => void;
};

type WatchPartyNavContextValue = {
  registration: WatchPartyNavRegistration | null;
  register: (value: WatchPartyNavRegistration) => void;
  unregister: () => void;
};

const WatchPartyNavContext = createContext<WatchPartyNavContextValue | null>(null);

export function WatchPartyNavProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<WatchPartyNavRegistration | null>(null);

  const register = useCallback((value: WatchPartyNavRegistration) => {
    setRegistration(value);
  }, []);

  const unregister = useCallback(() => {
    setRegistration(null);
  }, []);

  const value = useMemo(
    () => ({ registration, register, unregister }),
    [registration, register, unregister]
  );

  return (
    <WatchPartyNavContext.Provider value={value}>{children}</WatchPartyNavContext.Provider>
  );
}

export function useWatchPartyNav() {
  const ctx = useContext(WatchPartyNavContext);
  if (!ctx) {
    throw new Error("useWatchPartyNav must be used within WatchPartyNavProvider");
  }
  return ctx;
}
