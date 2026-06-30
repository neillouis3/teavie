import type { CSSProperties } from "react";

/** Shared frosted surface — kept light so backdrop blur reads clearly. */
const GLASS_SURFACE =
  "bg-background/20 backdrop-blur-3xl backdrop-saturate-125 supports-[backdrop-filter]:bg-background/12 dark:bg-background/14 dark:supports-[backdrop-filter]:bg-background/10";

/** Static frosted glass (non-hero pages). */
export const NAV_GLASS_CLASS =
  `border-b border-divider/20 ${GLASS_SURFACE} dark:border-white/[0.06]`;

/** Frosted sidebar body — top row stays transparent over the full-bleed nav. */
export const SIDEBAR_GLASS_CLASS = GLASS_SURFACE;

/** Inline styles for scroll-driven nav chrome (hero pages). */
export function navChromeStyle(blend: number): CSSProperties {
  const t = Math.min(1, Math.max(0, blend));
  const blurPx = t * 56;
  const bgPct = Math.round(1 + t * 28);

  return {
    backgroundColor: `color-mix(in srgb, var(--background) ${bgPct}%, transparent)`,
    backdropFilter: blurPx > 0.5 ? `blur(${blurPx}px) saturate(1.15)` : "none",
    WebkitBackdropFilter: blurPx > 0.5 ? `blur(${blurPx}px) saturate(1.15)` : "none",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: `color-mix(in srgb, var(--foreground) ${Math.round(t * 14)}%, transparent)`,
  };
}

export function navOverHero(blend: number): boolean {
  return blend < 0.55;
}
