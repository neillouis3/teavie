/** Fixed top nav bar height — matches Tailwind `h-14`. */
export const NAV_BAR_H = "h-14";

/** Nav bar height in rem — used in calc() strings for hero bleed. */
export const NAV_BLEED_EXTEND_REM = "3.5rem";

/** Desktop float offset above the pill (`pt-3`). */
export const NAV_DESKTOP_FLOAT_TOP_REM = "0.75rem";

/** Breathing room between floating nav bottom and page content on desktop. */
export const NAV_CONTENT_GAP_REM = "0.75rem";

/** Mobile/tablet fixed nav shell (< lg). */
export const NAV_MOBILE_SHELL_CLASS =
  "fixed inset-x-0 top-0 z-50 flex items-center gap-2 px-4 sm:px-6 lg:hidden pt-[env(safe-area-inset-top,0px)] min-h-[calc(3.5rem+env(safe-area-inset-top,0px))]";

/** Mobile nav Suspense fallback — matches shell footprint without interactive content. */
export const NAV_MOBILE_FALLBACK_CLASS =
  "fixed inset-x-0 top-0 z-50 bg-background lg:hidden pt-[env(safe-area-inset-top,0px)] min-h-[calc(3.5rem+env(safe-area-inset-top,0px))]";

/** Desktop floating nav outer shell (lg+). */
export const NAV_DESKTOP_SHELL_CLASS =
  "pointer-events-none fixed inset-x-0 top-0 z-50 hidden px-4 pt-3 sm:px-6 lg:flex lg:justify-center";

/** Desktop floating nav inner pill. */
export const NAV_DESKTOP_INNER_CLASS =
  "pointer-events-auto flex h-14 w-full max-w-[80rem] items-center gap-1.5 rounded-[1.15rem] border border-white/10 bg-background/58 px-3 text-foreground shadow-[0_14px_40px_rgba(0,0,0,0.2)] backdrop-blur-2xl supports-[backdrop-filter]:bg-background/44 dark:bg-black/45";

/** Main content top offset for non-hero pages. */
export const NAV_MAIN_TOP_OFFSET =
  "pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pt-[calc(0.75rem+3.5rem+0.75rem)]";

/** Hero / banner clearance below fixed nav (no content gap). */
export const NAV_HERO_CLEARANCE =
  "pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pt-[calc(0.75rem+3.5rem)]";
