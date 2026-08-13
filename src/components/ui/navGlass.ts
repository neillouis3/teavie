import type { CSSProperties } from "react";

/** Shared white frosted chrome (pill + full-width bar). */
export const NAV_CHROME_BASE =
  "bg-white/80 backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-white/72 dark:bg-white/[0.14] dark:supports-[backdrop-filter]:bg-white/[0.12]";

/** Static white chrome (non-hero mobile header). */
export const NAV_GLASS_CLASS =
  `${NAV_CHROME_BASE} border-b border-black/[0.06] dark:border-white/10`;

/** Floating desktop nav pill. */
export const NAV_CHROME_PILL_CLASS =
  `${NAV_CHROME_BASE} rounded-[1.15rem] border border-black/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.08)] dark:border-white/15 dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]`;

/** Lighter sidebar glass — same blur as nav, more opaque so content shows through less. */
export const SIDEBAR_GLASS_CLASS =
  "bg-background/52 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/44 dark:bg-background/48 dark:supports-[backdrop-filter]:bg-background/40";

/** Auth panel — opaque enough for readable forms over the poster collage. */
export const AUTH_PANEL_GLASS_CLASS =
  "bg-background/92 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/88 dark:bg-background/48 dark:supports-[backdrop-filter]:bg-background/40";

/** Modal glass — same blur as sidebar, 75% background fill. */
export const MODAL_GLASS_CLASS =
  "bg-background/75 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/75 dark:bg-background/75 dark:supports-[backdrop-filter]:bg-background/75";

type NavChromeOptions = {
  maxBlurPx?: number;
  maxBgPct?: number;
};

/** Inline styles for scroll-driven nav chrome (hero pages). */
export function navChromeStyle(
  blend: number,
  opts: NavChromeOptions = {}
): CSSProperties {
  const { maxBlurPx = 40, maxBgPct = 72 } = opts;
  const t = Math.min(1, Math.max(0, blend));
  const blurPx = t * maxBlurPx;
  const bgPct = Math.round(4 + t * maxBgPct);

  return {
    backgroundColor: `color-mix(in srgb, white ${bgPct}%, transparent)`,
    backdropFilter: blurPx > 1 ? `blur(${blurPx}px) saturate(180%)` : "none",
    WebkitBackdropFilter: blurPx > 1 ? `blur(${blurPx}px) saturate(180%)` : "none",
  };
}

/** Sidebar hero scroll chrome — same blur as nav, slightly more opaque. */
export function sidebarChromeStyle(blend: number): CSSProperties {
  return navChromeStyle(blend, { maxBlurPx: 40, maxBgPct: 44 });
}

export function navOverHero(blend: number): boolean {
  return blend < 0.55;
}
