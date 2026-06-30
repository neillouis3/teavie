import type { CSSProperties } from "react";

const GLASS_SURFACE =
  "bg-background/40 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/32 dark:bg-background/32 dark:supports-[backdrop-filter]:bg-background/26";

/** Static frosted glass (non-hero pages). */
export const NAV_GLASS_CLASS =
  `border-b border-divider/15 ${GLASS_SURFACE} dark:border-white/[0.04]`;

/** Frosted sidebar — pairs with full-bleed top nav. */
export const SIDEBAR_GLASS_CLASS = GLASS_SURFACE;

/** Inline styles for scroll-driven nav chrome (hero pages). */
export function navChromeStyle(blend: number): CSSProperties {
  const t = Math.min(1, Math.max(0, blend));
  const blurPx = t * 40;
  const bgPct = Math.round(2 + t * 36);

  return {
    backgroundColor: `color-mix(in srgb, var(--background) ${bgPct}%, transparent)`,
    backdropFilter: blurPx > 1 ? `blur(${blurPx}px)` : "none",
    WebkitBackdropFilter: blurPx > 1 ? `blur(${blurPx}px)` : "none",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: `color-mix(in srgb, var(--foreground) ${Math.round(t * 12)}%, transparent)`,
  };
}

export function navOverHero(blend: number): boolean {
  return blend < 0.55;
}
