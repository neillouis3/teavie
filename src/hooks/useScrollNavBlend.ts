"use client";

import { useEffect, useState } from "react";

/** Pixels scrolled before the nav reaches full frosted glass (0 → 1). */
export const NAV_SCROLL_BLEND_RANGE = 220;

/**
 * 0 at page top, 1 after `scrollRange` px — drives clear → blurred nav on hero pages.
 */
export function useScrollNavBlend(enabled: boolean, scrollRange = NAV_SCROLL_BLEND_RANGE) {
  const [blend, setBlend] = useState(enabled ? 0 : 1);

  useEffect(() => {
    if (!enabled) {
      setBlend(1);
      return;
    }

    const update = () => {
      const t = Math.min(1, Math.max(0, window.scrollY / scrollRange));
      setBlend(t);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [enabled, scrollRange]);

  return blend;
}
