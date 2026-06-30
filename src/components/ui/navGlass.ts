import type { CSSProperties } from "react";

/** Static frosted glass (non-hero pages). */
export const NAV_GLASS_CLASS =
  "bg-background/40 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/32 dark:bg-background/32 dark:supports-[backdrop-filter]:bg-background/26";

/** Lighter sidebar glass — less blur and opacity so content shows through more. */
export const SIDEBAR_GLASS_CLASS =
  "bg-background/20 backdrop-blur-md supports-[backdrop-filter]:bg-background/14 dark:bg-background/16 dark:supports-[backdrop-filter]:bg-background/12";

type NavChromeOptions = {
  maxBlurPx?: number;
  maxBgPct?: number;
};

/** Inline styles for scroll-driven nav chrome (hero pages). */
export function navChromeStyle(
  blend: number,
  opts: NavChromeOptions = {}
): CSSProperties {
  const { maxBlurPx = 40, maxBgPct = 36 } = opts;
  const t = Math.min(1, Math.max(0, blend));
  const blurPx = t * maxBlurPx;
  const bgPct = Math.round(2 + t * maxBgPct);

  return {
    backgroundColor: `color-mix(in srgb, var(--background) ${bgPct}%, transparent)`,
    backdropFilter: blurPx > 1 ? `blur(${blurPx}px)` : "none",
    WebkitBackdropFilter: blurPx > 1 ? `blur(${blurPx}px)` : "none",
  };
}

/** Sidebar hero scroll chrome — softer than top nav. */
export function sidebarChromeStyle(blend: number): CSSProperties {
  return navChromeStyle(blend, { maxBlurPx: 14, maxBgPct: 18 });
}

export function navOverHero(blend: number): boolean {
  return blend < 0.55;
}
