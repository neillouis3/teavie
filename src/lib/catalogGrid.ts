/** Shared catalog grids: responsive column ladder (sidebar-aware at lg). */

export const CATALOG_GRID_VERTICAL =
  'grid h-full w-full grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7';

export const CATALOG_GRID_HORIZONTAL =
  'grid h-full w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-7';

/** Search / sections without `h-full` on the grid wrapper */
export const CATALOG_GRID_VERTICAL_SEARCH =
  'grid w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7';

export const CATALOG_GRID_HORIZONTAL_SEARCH =
  'grid w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';

/** Shared rail spacing scale (12px gutter, 32px section). */
export const RAIL_ITEM_PAD = 'pl-3';
export const RAIL_TRACK = '-ml-3';

/** Horizontal portrait rails: 8 full cards + ½ peek from `lg`. */
export const RAIL_CAROUSEL_ITEM_VERTICAL =
  `basis-[45%] ${RAIL_ITEM_PAD} sm:basis-[32%] md:basis-1/5 lg:basis-[calc((100%-6rem)/8.5)]`;

/** Detail modal rails: 5 cards across from `md`. */
export const DETAIL_RAIL_CAROUSEL_ITEM_VERTICAL =
  "basis-[45%] pl-3 sm:basis-[32%] md:basis-1/5 lg:basis-1/5";

export const DETAIL_RAIL_MAX_ITEMS = 5;

export const RAIL_CAROUSEL_ITEM_VERTICAL_PROFILE =
  `basis-[45%] ${RAIL_ITEM_PAD} sm:basis-[30%] md:basis-1/4 lg:basis-[calc((100%-6rem)/8.5)]`;

/** Landscape catalog rails (collection, related, etc.). */
export const RAIL_CAROUSEL_ITEM_HORIZONTAL =
  `basis-[88%] ${RAIL_ITEM_PAD} sm:basis-[55%] md:basis-[42%] lg:basis-1/3 xl:basis-1/4`;

/** Continue watching: 4 full cards + ½ peek from `lg`. */
export const RAIL_CAROUSEL_ITEM_CONTINUE_WATCHING =
  `basis-[85%] ${RAIL_ITEM_PAD} sm:basis-[52%] md:basis-[38%] lg:basis-[calc((100%-3.375rem)/4.5)] xl:basis-[calc((100%-3.375rem)/4.5)]`;

/** Genre tiles: slightly wider than portrait rails (one fewer visible). */
export const RAIL_CAROUSEL_ITEM_GENRE =
  `basis-[48%] ${RAIL_ITEM_PAD} sm:basis-[34%] md:basis-[22%] lg:basis-[calc(100%/6.5)]`;

export const EXPLORE_RAIL_MAX_ITEMS = 50;
export const NEW_ON_TEAVIE_MAX_ITEMS = 20;

/** Title → cards (12px). */
export const RAIL_INNER_CLASS = 'flex w-full flex-col gap-3';

/** Stacked blocks on movie/show detail views and modals. */
export const DETAIL_CONTENT_STACK_CLASS = 'flex w-full flex-col gap-8';

/** Detail-page rails below the hero (collection, you might like, trailer). */
export const DETAIL_RAIL_SECTION_CLASS = 'flex w-full flex-col gap-3';

/** Between stacked rails (32px). */
export const RAIL_STACK_CLASS = 'flex w-full flex-col gap-8';

/** Centered library grid — portrait cards in a narrow column. */
export const LIBRARY_GRID_CLASS =
  'mx-auto grid w-full max-w-4xl grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

/** Collection page — centered row of portrait cards (handles short lists). */
export const COLLECTION_PAGE_GRID_CLASS =
  'mx-auto flex w-full max-w-4xl flex-wrap justify-center gap-x-5 gap-y-8';

/** Person page filmography — 6 columns from lg, equal gutters. */
export const PERSON_FILMOGRAPHY_GRID_CLASS =
  'grid w-full grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';

/** Full-bleed category hub rails (no content gutter). */
export const FLUSH_RAIL_TRACK = 'ml-0 gap-3';

export function flushRailItemClass(itemClass: string) {
  return itemClass.replace(RAIL_ITEM_PAD, 'pl-0');
}

export const FLUSH_RAIL_CAROUSEL_ITEM_VERTICAL = flushRailItemClass(RAIL_CAROUSEL_ITEM_VERTICAL);
export const FLUSH_RAIL_CAROUSEL_ITEM_HORIZONTAL = flushRailItemClass(RAIL_CAROUSEL_ITEM_HORIZONTAL);
export const FLUSH_RAIL_CAROUSEL_ITEM_GENRE = flushRailItemClass(RAIL_CAROUSEL_ITEM_GENRE);

/** Spotlight → first rail; matches `RAIL_STACK_CLASS` gap. */
export const RAIL_AFTER_SPOTLIGHT = 'mb-8';
