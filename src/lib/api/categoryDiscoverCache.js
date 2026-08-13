import { unstable_cache } from "next/cache";
import clientPromise from "@/lib/mongo";
import { fetchCategoryDiscover } from "@/lib/categoryDiscover";

const DISCOVER_REVALIDATE_SEC = 3600;

/**
 * Server-side cache for category hub payloads (anime / kdrama landing pages).
 * Preference-filtered POST requests bypass this and hit Mongo directly.
 */
export function getCachedCategoryDiscover(slug) {
  return unstable_cache(
    async () => {
      const client = await clientPromise;
      const col = client.db("teavie").collection("content");
      return fetchCategoryDiscover(col, slug, null);
    },
    [`category-discover-${slug}`],
    { revalidate: DISCOVER_REVALIDATE_SEC, tags: [`category-discover-${slug}`] }
  )();
}

export const CATEGORY_DISCOVER_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};
