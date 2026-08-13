export const CATALOG_FILTER_BORDERED_FIELD =
  "border-default-200/80 shadow-none dark:border-white/10 bg-transparent";

export const CATALOG_FILTER_SELECT_BASE =
  "w-full min-w-0 sm:w-32 sm:min-w-32 sm:max-w-32 sm:shrink-0";

export const CATALOG_FILTER_SELECT_WIDE =
  "w-full min-w-0 sm:w-44 sm:min-w-44 sm:max-w-44 sm:shrink-0";

export const catalogFilterSortClassNames = {
  base: CATALOG_FILTER_SELECT_WIDE,
  value: "font-normal text-foreground",
  selectorIcon: "text-default-400",
  trigger: CATALOG_FILTER_BORDERED_FIELD,
} as const;

export function catalogFilterSelectClassNames(hasValue: boolean, wide = false) {
  return {
    base: wide ? CATALOG_FILTER_SELECT_WIDE : CATALOG_FILTER_SELECT_BASE,
    value: hasValue ? "font-normal text-foreground" : "font-normal text-default-500",
    selectorIcon: "text-default-400",
    trigger: CATALOG_FILTER_BORDERED_FIELD,
  } as const;
}
