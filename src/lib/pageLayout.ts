/** Shared layout + typography for library-style and catalog list pages. */

import {
  TEXT_CAPTION_MUTED,
  TEXT_PAGE_TITLE,
  TEXT_SECTION,
  TEXT_UI_MUTED,
} from "@/lib/typography";

export const PAGE_SHELL_MIN =
  "relative min-h-screen w-full overflow-x-hidden pb-20";

export const PAGE_CONTENT_OUTER =
  "relative z-10 mx-auto flex w-full max-w-6xl flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8 lg:pt-24";

export const USER_PAGE_HEADER =
  "mx-auto flex w-full max-w-2xl flex-col items-center text-center";

export const CATALOG_PAGE_HEADER =
  "mx-auto flex w-full max-w-3xl flex-col items-center text-center";

export const PAGE_TITLE = TEXT_PAGE_TITLE;

export const PAGE_TITLE_CENTERED = `max-w-2xl ${PAGE_TITLE}`;

export const PAGE_DESCRIPTION = `mt-2 max-w-md leading-relaxed ${TEXT_UI_MUTED}`;

export const PAGE_META = `mt-3 ${TEXT_UI_MUTED}`;

export const PAGE_BODY = TEXT_UI_MUTED;

export const PAGE_SECTION = "mt-10 w-full";

export const PAGE_CONTENT_AFTER_HEADER = "mx-auto mt-10 w-full";

export const PAGE_FOOTER = "mx-auto mt-12 w-full max-w-2xl text-center";

export const PAGE_FOOTER_TITLE = `${TEXT_SECTION} text-foreground`;

export const PAGE_FOOTER_SUBTITLE = `mt-1 ${TEXT_UI_MUTED}`;

export const PAGE_FOOTER_BODY = `mt-4 leading-relaxed ${TEXT_UI_MUTED}`;

export const PAGE_CARD_TITLE =
  "flex items-center gap-2 text-base font-normal text-foreground";

export const PAGE_CARD_LABEL = `flex items-center gap-2 ${TEXT_UI_MUTED}`;

export const PAGE_CARD_FOOTER = `leading-relaxed ${TEXT_CAPTION_MUTED}`;

export const PAGE_SEARCH_INPUT =
  "h-8 w-36 rounded-full border border-default-200/40 bg-default-100/30 py-0 pl-8 pr-3 text-xs text-foreground placeholder:text-default-400 focus:border-default-300 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:placeholder:text-white/35 sm:w-44";
