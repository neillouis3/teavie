/** Frosted chrome blur used on immersive watch overlays and episode panels. */
import { TEXT_CAPTION, TEXT_WATCH_TOOLBAR } from "@/lib/typography";
export const WATCH_CHROME_BLUR_CLASS =
  "border border-white/15 bg-black/45 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-2xl backdrop-saturate-150 supports-[backdrop-filter]:bg-black/38";

/** Top-left safe-area offset for watch chrome overlays. */
export const WATCH_OVERLAY_TOP_CLASS =
  "top-[max(1rem,env(safe-area-inset-top))]";

/** Horizontal safe-area inset for watch chrome overlays. */
export const WATCH_OVERLAY_LEFT_CLASS =
  "left-[max(1rem,env(safe-area-inset-left))]";

/** Watch dropdown menu — frosted dark panel matching episode chrome. */
export const WATCH_DROPDOWN_CLASS =
  "border border-white/15 bg-black/80 p-1 text-white shadow-[0_14px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl";

/** Watch toolbar label — matches immersive chrome buttons (Sub, Prev, Episodes). */
export const WATCH_TOOLBAR_TEXT_CLASS = TEXT_WATCH_TOOLBAR;

/** Bare watch chrome control — transparent, same height as back / episode buttons. */
export const WATCH_TOOLBAR_BUTTON_CLASS =
  "h-11 min-h-11 shrink-0 cursor-pointer bg-transparent shadow-none hover:bg-transparent hover:opacity-100 data-[hover=true]:bg-transparent data-[hover=true]:opacity-100";

/**
 * Watch dropdown row — navbar-style hover/selected fill, toolbar text color.
 * Mirrors NAV_MENU_ITEM_CLASS but tuned for dark watch overlays.
 */
export const WATCH_MENU_ITEM_CLASS =
  `rounded-lg ${TEXT_CAPTION} font-normal text-white data-[hover=true]:bg-white/[0.06] data-[hover=true]:text-white data-[focus-visible=true]:bg-white/[0.06] data-[focus-visible=true]:text-white data-[selected=true]:bg-white/[0.06] data-[selected=true]:text-white`;
