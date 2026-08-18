"use client";

import { useEffect, useRef } from "react";
import { useWatchPartyNav } from "@/contexts/watchPartyNavContext";

/** Opens Tea Party for the host when a guest join triggers sync hold. */
export default function TeaPartyHostSyncListener() {
  const { registration, openTeaParty } = useWatchPartyNav();
  const openedForHoldRef = useRef<string | null>(null);

  useEffect(() => {
    const room = registration?.room;
    if (!registration?.isHost || !room?.syncHold?.active) return;
    if (room.settings.onGuestJoin === "off") return;

    const holdKey = room.syncHold.startedAt ?? "active";
    if (openedForHoldRef.current === holdKey) return;
    openedForHoldRef.current = holdKey;
    openTeaParty();
  }, [
    registration?.isHost,
    registration?.room?.syncHold?.active,
    registration?.room?.syncHold?.startedAt,
    registration?.room?.settings?.onGuestJoin,
    openTeaParty,
  ]);

  useEffect(() => {
    if (!registration?.room?.syncHold?.active) {
      openedForHoldRef.current = null;
    }
  }, [registration?.room?.syncHold?.active]);

  return null;
}
