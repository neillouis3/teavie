/**
 * App-wide typography scale. Use Tailwind size tokens only — no arbitrary px sizes.
 *
 * xs (12px)  — captions, badges, meta, watch toolbar
 * sm (14px)  — default UI copy, descriptions, inputs, buttons
 * base (16px)— card titles, modal headings, emphasized body
 * lg (18px)  — section headers (detail rails, explore)
 * xl+        — page titles
 */

/** Default UI / body copy */
export const TEXT_UI = "text-sm";

/** Secondary descriptions and helper text */
export const TEXT_UI_MUTED = "text-sm text-default-500";

/** Small meta, badges, timestamps */
export const TEXT_CAPTION = "text-xs";

/** Small meta with muted color */
export const TEXT_CAPTION_MUTED = "text-xs text-default-500";

/** Card and list primary titles */
export const TEXT_TITLE = "text-base font-medium text-foreground";

/** Responsive card title — sm on mobile, base from sm breakpoint */
export const TEXT_TITLE_RESPONSIVE =
  "text-sm font-normal text-foreground sm:text-base";

/** Modal / panel heading */
export const TEXT_HEADING = "text-base font-semibold text-foreground";

/** Detail and explore section headers */
export const TEXT_SECTION = "text-lg font-normal tracking-tight text-foreground";

/** Full page titles */
export const TEXT_PAGE_TITLE =
  "text-2xl font-normal tracking-tight text-foreground sm:text-3xl";

/** Immersive watch overlay toolbar labels */
export const TEXT_WATCH_TOOLBAR = "text-xs font-normal text-white";

/** Uppercase field / category labels */
export const TEXT_LABEL =
  "text-xs font-medium uppercase tracking-wide text-default-500";
