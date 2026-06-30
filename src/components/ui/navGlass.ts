import type { CSSProperties } from "react";

const GLASS_SURFACE =
  "bg-background/40 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/32 dark:bg-background/32 dark:supports-[backdrop-filter]:bg-background/26";

/** Static frosted glass (non-hero pages). */
export const NAV_GLASS_CLASS =
  `border-b border-divider/15 ${GLASS_SURFACE} dark:border-white/[0.04]`;

/** Static frosted glass for the fixed desktop sidebar. */
export const SIDEBAR_GLASS_CLASS =
  `border-r border-divider/15 ${GLASS_SURFACE} dark:border-white/[0.04]`;

function glassChromeStyle(blend: number, edge: "bottom" | "right"): CSSProperties {
  const t = Math.min(1, Math.max(0, blend));
  const blurPx = t * 40;
  const bgPct = Math.round(2 + t * 36);
  const borderColor = `color-mix(in srgb, var(--foreground) ${Math.round(t * 12)}%, transparent)`;

  return {
    backgroundColor: `color-mix(in srgb, var(--background) ${bgPct}%, transparent)`,
    backdropFilter: blurPx > 1 ? `blur(${blurPx}px)` : "none",
    WebkitBackdropFilter: blurPx > 1 ? `blur(${blurPx}px)` : "none",
    ...(edge === "bottom"
      ? {
          borderBottomWidth: "1px",
          borderBottomStyle: "solid",
          borderBottomColor: borderColor,
        }
      : {
          borderRightWidth: "1px",
          borderRightStyle: "solid",
          borderRightColor: borderColor,
        }),
  };
}

/** Inline styles for scroll-driven nav chrome (hero pages). */
export function navChromeStyle(blend: number): CSSProperties {
  return glassChromeStyle(blend, "bottom");
}

/** Inline styles for scroll-driven sidebar chrome (hero pages). */
export function sidebarChromeStyle(blend: number): CSSProperties {
  return glassChromeStyle(blend, "right");
}

export function navOverHero(blend: number): boolean {
  return blend < 0.55;
}
