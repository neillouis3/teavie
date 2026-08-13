import { unstable_cache } from "next/cache";

/** Server-side cache for browse /all pages (per filter + page/cursor). */
export function getCachedCatalogBrowse(cacheKey, loader) {
  return unstable_cache(loader, [`catalog-browse-v1-${cacheKey}`], {
    revalidate: 600,
    tags: ["catalog-browse"],
  })();
}
