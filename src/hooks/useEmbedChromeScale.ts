"use client";

import { useEffect, useState } from "react";
import { EMBED_DESKTOP_ICON_SIZE } from "@/lib/embedHosts";

/** Mirrors the `lg:` variant (incl. `html.tv-desktop`) that zooms the iframe. */
function isZoomedViewport(): boolean {
  if (typeof window === "undefined") return false;
  return (
    document.documentElement.classList.contains("tv-desktop") ||
    window.matchMedia("(min-width: 1024px)").matches
  );
}

export type EmbedChromeScale = {
  /** False during the server pass and until the first client effect runs. */
  ready: boolean;
  /** Nullish means the provider default. */
  iconSize: number | null;
};

/**
 * Resolved once on mount and never on resize: the scale rides in the embed URL,
 * so re-resolving would swap the iframe `src` and restart playback.
 */
export function useEmbedChromeScale(): EmbedChromeScale {
  const [scale, setScale] = useState<EmbedChromeScale>({
    ready: false,
    iconSize: null,
  });

  useEffect(() => {
    setScale({
      ready: true,
      iconSize: isZoomedViewport() ? EMBED_DESKTOP_ICON_SIZE : null,
    });
  }, []);

  return scale;
}
