import type { CSSProperties } from "react";

/** Static frosted glass (non-hero pages). */
export const NAV_GLASS_CLASS =
  "bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/82 dark:bg-background/32 dark:supports-[backdrop-filter]:bg-background/26";

/** Lighter sidebar glass — same blur as nav, more opaque so content shows through less. */
export const SIDEBAR_GLASS_CLASS =
  "bg-background/52 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/44 dark:bg-background/48 dark:supports-[backdrop-filter]:bg-background/40";

/** Auth panel — opaque enough for readable forms over the poster collage. */
export const AUTH_PANEL_GLASS_CLASS =
  "bg-background/92 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/88 dark:bg-background/48 dark:supports-[backdrop-filter]:bg-background/40";

/** Popover / dropdown menus — matches floating nav chrome. */
export const MENU_GLASS_CLASS =
  "border border-default-200/70 bg-background/95 p-1 text-sm shadow-[0_10px_32px_rgba(15,23,42,0.1)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/92 dark:border-white/10 dark:bg-black/50 dark:shadow-[0_14px_40px_rgba(0,0,0,0.25)] dark:supports-[backdrop-filter]:bg-black/42";

/** Dropdown row hover — matches desktop nav link chrome. */
export const NAV_MENU_ITEM_CLASS =
  "rounded-lg text-sm font-medium text-foreground/70 data-[hover=true]:bg-foreground/[0.06] data-[hover=true]:text-foreground data-[focus-visible=true]:bg-foreground/[0.06] data-[focus-visible=true]:text-foreground";

/** Destructive dropdown row — danger text with subtle hover fill. */
export const NAV_MENU_ITEM_DANGER_CLASS =
  "rounded-lg text-sm font-medium text-danger data-[hover=true]:bg-danger/10 data-[hover=true]:text-danger data-[focus-visible=true]:bg-danger/10 data-[focus-visible=true]:text-danger";

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

/** Sidebar hero scroll chrome — same blur as nav, slightly more opaque. */
export function sidebarChromeStyle(blend: number): CSSProperties {
  return navChromeStyle(blend, { maxBlurPx: 40, maxBgPct: 44 });
}

export function navOverHero(blend: number): boolean {
  return blend < 0.55;
}
