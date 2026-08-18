"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { MaximizeScreenIcon } from "@hugeicons/core-free-icons";
import { WATCH_TOOLBAR_BUTTON_CLASS } from "@/lib/watchChrome";
import { cn } from "@/lib/utils";

export const WATCH_ROOT_ATTR = "data-watch-root";

function watchRoot(): HTMLElement | null {
  return document.querySelector(`[${WATCH_ROOT_ATTR}]`);
}

export function toggleWatchFullscreen(): void {
  const root = watchRoot();
  if (!root) return;
  if (document.fullscreenElement) {
    void document.exitFullscreen();
  } else {
    void root.requestFullscreen?.();
  }
}

/** Fullscreen toggle for immersive watch chrome — replaces VidFast's oversized control. */
export default function WatchFullscreenButton({ className }: { className?: string }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const onPress = useCallback(() => toggleWatchFullscreen(), []);

  return (
    <Button
      isIconOnly
      size="sm"
      variant="light"
      radius="md"
      aria-label={active ? "Exit fullscreen" : "Enter fullscreen"}
      onPress={onPress}
      className={cn(
        WATCH_TOOLBAR_BUTTON_CLASS,
        "min-w-11 px-0 text-white",
        active && "text-success",
        className
      )}
    >
      <HugeiconsIcon icon={MaximizeScreenIcon} size={18} className="shrink-0" />
    </Button>
  );
}
