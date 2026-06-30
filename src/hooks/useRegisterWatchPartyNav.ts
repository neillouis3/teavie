"use client";

import { useEffect, useRef } from "react";
import {
  useWatchPartyNav,
  type WatchPartyNavRegistration,
} from "@/contexts/watchPartyNavContext";

export function useRegisterWatchPartyNav(
  registration: WatchPartyNavRegistration | null
) {
  const { register, unregister } = useWatchPartyNav();
  const regRef = useRef(registration);
  regRef.current = registration;

  useEffect(() => {
    return unregister;
  }, [unregister]);

  useEffect(() => {
    const r = regRef.current;
    if (!r?.canPlay) {
      unregister();
      return;
    }
    register(r);
  }, [
    registration?.canPlay,
    registration?.room?.roomId,
    registration?.room?.stateVersion,
    registration?.room?.playbackVersion,
    registration?.room?.messages?.length,
    registration?.room?.members?.length,
    registration?.isHost,
    registration?.loading,
    registration?.error,
    registration?.nickname,
    registration?.mediaType,
    register,
    unregister,
  ]);
}
