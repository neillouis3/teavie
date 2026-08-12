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

export const RAIL_CAROUSEL_ITEM_VERTICAL_PROFILE =
  `basis-[45%] ${RAIL_ITEM_PAD} sm:basis-[30%] md:basis-1/4 lg:basis-[calc((100%-6rem)/8.5)]`;

/** Landscape / continue-watching style cards. */
export const RAIL_CAROUSEL_ITEM_HORIZONTAL =
  `basis-[88%] ${RAIL_ITEM_PAD} sm:basis-[55%] md:basis-[42%] lg:basis-1/3 xl:basis-1/4`;

/** Genre tiles: slightly wider than portrait rails (one fewer visible). */
export const RAIL_CAROUSEL_ITEM_GENRE =
  `basis-[48%] ${RAIL_ITEM_PAD} sm:basis-[34%] md:basis-[22%] lg:basis-[calc(100%/6.5)]`;

export const EXPLORE_RAIL_MAX_ITEMS = 50;
export const NEW_ON_TEAVIE_MAX_ITEMS = 20;

/** Title → cards (12px). */
export const RAIL_INNER_CLASS = 'flex w-full flex-col gap-3';

/** Between stacked rails (32px). */
export const RAIL_STACK_CLASS = 'flex w-full flex-col gap-8';

/** Spotlight → first rail; matches `RAIL_STACK_CLASS` gap. */
export const RAIL_AFTER_SPOTLIGHT = 'mb-8';
