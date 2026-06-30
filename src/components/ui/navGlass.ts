import type { CSSProperties } from "react";

/** Static frosted glass (non-hero pages). */
export const NAV_GLASS_CLASS =
  "bg-background/40 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/32 dark:bg-background/32 dark:supports-[backdrop-filter]:bg-background/26";

/** Inline styles for scroll-driven nav chrome (hero pages). */
export function navChromeStyle(blend: number): CSSProperties {
  const t = Math.min(1, Math.max(0, blend));
  const blurPx = t * 40;
  const bgPct = Math.round(2 + t * 36);

  return {
    backgroundColor: `color-mix(in srgb, var(--background) ${bgPct}%, transparent)`,
    backdropFilter: blurPx > 1 ? `blur(${blurPx}px)` : "none",
    WebkitBackdropFilter: blurPx > 1 ? `blur(${blurPx}px)` : "none",
  };
}

export function navOverHero(blend: number): boolean {
  return blend < 0.55;
}
