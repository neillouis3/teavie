/** Shared catalog grids: responsive column ladder (sidebar-aware at lg). */

export const CATALOG_GRID_VERTICAL =
  'grid h-full w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7';

export const CATALOG_GRID_HORIZONTAL =
  'grid h-full w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';

/** Search / sections without `h-full` on the grid wrapper */
export const CATALOG_GRID_VERTICAL_SEARCH =
  'grid w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7';

export const CATALOG_GRID_HORIZONTAL_SEARCH =
  'grid w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6';

/** Horizontal portrait rails: 7 full cards + ⅓ peek from `lg`. */
export const RAIL_CAROUSEL_ITEM_VERTICAL =
  'basis-[45%] pl-3 sm:basis-[32%] md:basis-1/5 lg:basis-[calc(100%/7.3333333333)]';

export const RAIL_CAROUSEL_ITEM_VERTICAL_PROFILE =
  'basis-[45%] pl-3 sm:basis-[30%] md:basis-1/4 lg:basis-[calc(100%/7.3333333333)]';

export const EXPLORE_RAIL_MAX_ITEMS = 50;
export const NEW_ON_TEAVIE_MAX_ITEMS = 20;
