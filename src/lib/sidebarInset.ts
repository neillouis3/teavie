/** Descendants with this attribute extend under the glass sidebar on lg+. */
export const SIDEBAR_BLEED_ATTR = "data-sidebar-bleed";

/**
 * Main scroll column: inset readable text while allowing `data-sidebar-bleed`
 * sections (e.g. Explore spotlight) to extend under the glass sidebar.
 */
export const SIDEBAR_CONTENT_INSET =
  "lg:pl-[var(--sidebar-w,16rem)] [&_[data-sidebar-bleed]]:lg:-ml-[var(--sidebar-w,16rem)] [&_[data-sidebar-bleed]]:lg:w-[calc(100%+var(--sidebar-w,16rem))]";

/** Horizontal padding that clears the fixed sidebar on lg+. */
export const SIDEBAR_AWARE_X =
  "px-3 sm:px-4 lg:pl-[calc(var(--sidebar-w,16rem)+0.75rem)]";
