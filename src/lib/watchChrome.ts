/** Frosted chrome blur used on immersive watch overlays and episode panels. */
export const WATCH_CHROME_BLUR_CLASS =
  "border border-white/15 bg-black/45 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-black/38";

/** Top-left safe-area offset for watch chrome overlays. */
export const WATCH_OVERLAY_TOP_CLASS =
  "top-[max(1rem,env(safe-area-inset-top))]";

/** Horizontal safe-area inset for watch chrome overlays. */
export const WATCH_OVERLAY_LEFT_CLASS =
  "left-[max(1rem,env(safe-area-inset-left))]";

/** Watch toolbar label — matches immersive chrome buttons (Sub, Prev, Episodes). */
export const WATCH_TOOLBAR_TEXT_CLASS = "text-xs font-normal text-white";

/**
 * Watch dropdown row — navbar-style hover/selected fill, toolbar text color.
 * Mirrors NAV_MENU_ITEM_CLASS but tuned for dark watch overlays.
 */
export const WATCH_MENU_ITEM_CLASS =
  "rounded-lg text-xs font-normal text-white data-[hover=true]:bg-white/[0.06] data-[hover=true]:text-white data-[focus-visible=true]:bg-white/[0.06] data-[focus-visible=true]:text-white data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-white";
