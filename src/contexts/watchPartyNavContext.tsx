"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { WatchPartyRoom } from "@/hooks/useWatchParty";
import type { TeaPartySettings, TeaPartyGuestSyncRole } from "@/lib/teaPartySync";

export type WatchPartyNavRegistration = {
  canPlay: boolean;
  room: WatchPartyRoom | null;
  isHost: boolean;
  loading: boolean;
  error: string;
  nickname: string;
  mediaType: "tv" | "movie";
  title?: string;
  guestJoinSyncRole?: TeaPartyGuestSyncRole;
  onCreate: (nickname: string) => void | Promise<string | null>;
  onJoin: (roomId: string, nickname: string) => void;
  onLeave: () => void;
  onSendChat: (text: string) => void;
  onUpdateSettings: (settings: Partial<TeaPartySettings>) => void | Promise<void>;
  onReleaseSync: () => void | Promise<void>;
};

type WatchPartyNavContextValue = {
  registration: WatchPartyNavRegistration | null;
  register: (value: WatchPartyNavRegistration) => void;
  unregister: () => void;
  isOpen: boolean;
  openTeaParty: () => void;
  closeTeaParty: () => void;
  setTeaPartyOpen: (open: boolean) => void;
};

const WatchPartyNavContext = createContext<WatchPartyNavContextValue | null>(null);

export function WatchPartyNavProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<WatchPartyNavRegistration | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const register = useCallback((value: WatchPartyNavRegistration) => {
    setRegistration(value);
  }, []);

  const unregister = useCallback(() => {
    setRegistration(null);
  }, []);

  const openTeaParty = useCallback(() => setIsOpen(true), []);
  const closeTeaParty = useCallback(() => setIsOpen(false), []);
  const setTeaPartyOpen = useCallback((open: boolean) => setIsOpen(open), []);

  const value = useMemo(
    () => ({
      registration,
      register,
      unregister,
      isOpen,
      openTeaParty,
      closeTeaParty,
      setTeaPartyOpen,
    }),
    [registration, register, unregister, isOpen, openTeaParty, closeTeaParty, setTeaPartyOpen]
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
