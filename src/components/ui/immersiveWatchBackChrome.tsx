"use client";

import React from "react";
import WatchFullscreenButton from "@/components/ui/watchFullscreenButton";
import WatchPlayerBackButton from "@/components/ui/watchPlayerBackButton";
import WatchPlayerChromeBar from "@/components/ui/watchPlayerChromeBar";
import TeaPartyWatchButton from "@/components/watchParty/TeaPartyWatchButton";
import {
  WATCH_OVERLAY_LEFT_CLASS,
  WATCH_OVERLAY_TOP_CLASS,
} from "@/lib/watchChrome";
import { cn } from "@/lib/utils";

export default function ImmersiveWatchBackChrome() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[100]">
      <div
        className={cn(
          "pointer-events-auto absolute",
          WATCH_OVERLAY_TOP_CLASS,
          WATCH_OVERLAY_LEFT_CLASS
        )}
      >
        <WatchPlayerChromeBar>
          <WatchPlayerBackButton className="relative left-0 top-0 shrink-0 sm:left-0 sm:top-0" />
          <TeaPartyWatchButton />
          <WatchFullscreenButton />
        </WatchPlayerChromeBar>
      </div>
    </div>
  );
}
