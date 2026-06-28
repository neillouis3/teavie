/** @typedef {{
 *   slug: string;
 *   label: string;
 *   href: string;
 *   browseAllHref: string;
 *   browseAllLabel: string;
 *   browseAllCardText: string;
 *   aboutImage?: string | null;
 *   tileColor: string;
 * }} CatalogCategory
 */

/** @type {Record<string, CatalogCategory>} */
export const CATALOG_CATEGORIES = {
  anime: {
    slug: "anime",
    label: "Anime",
    href: "/anime",
    browseAllHref: "/anime/all?sort_by=popularity",
    browseAllLabel: "Browse all Anime",
    browseAllCardText: "Check out all anime here:",
    aboutImage: null,
    tileColor: "from-violet-400 to-purple-600",
  },
  kdrama: {
    slug: "kdrama",
    label: "Korean Drama",
    href: "/kdrama",
    browseAllHref: "/kdrama/all",
    browseAllLabel: "Browse all K-Drama",
    browseAllCardText: "Check out all K-Drama here:",
    aboutImage: "/qw.png",
    tileColor: "from-rose-400 to-pink-600",
  },
};

/** @returns {CatalogCategory[]} */
export function listCatalogCategories() {
  return Object.values(CATALOG_CATEGORIES);
}

/** @param {string} slug */
export function getCatalogCategory(slug) {
  const key = String(slug ?? "").trim().toLowerCase();
  return CATALOG_CATEGORIES[key] ?? null;
}

/** @param {string} slug */
export function isValidCatalogCategorySlug(slug) {
  return getCatalogCategory(slug) != null;
}

/** @param {CatalogCategory} category */
export function categoryBrowseSortHref(category, sortBy) {
  const qs = new URLSearchParams();
  if (sortBy && sortBy !== "title") qs.set("sort_by", sortBy);
  const q = qs.toString();
  return q ? `${category.browseAllHref}?${q}` : category.browseAllHref;
}

/** @param {CatalogCategory} category @param {string} genreSlug */
export function categoryGenreBrowseHref(category, genreSlug) {
  const qs = new URLSearchParams();
  if (genreSlug) qs.set("genre", genreSlug);
  qs.set("sort_by", "popularity");
  return `${category.browseAllHref}?${qs.toString()}`;
}
