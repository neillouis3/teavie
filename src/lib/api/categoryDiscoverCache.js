import { unstable_cache } from "next/cache";
import clientPromise from "@/lib/mongo";
import { fetchCategoryDiscover } from "@/lib/categoryDiscover";

const DISCOVER_REVALIDATE_SEC = 3600;
const ANIME_DISCOVER_REVALIDATE_SEC = 900;

/**
 * Server-side cache for category hub payloads (anime / kdrama landing pages).
 * Preference-filtered POST requests bypass this and hit Mongo directly.
 */
export function getCachedCategoryDiscover(slug) {
  const revalidate =
    slug === "anime" ? ANIME_DISCOVER_REVALIDATE_SEC : DISCOVER_REVALIDATE_SEC;
  return unstable_cache(
    async () => {
      const client = await clientPromise;
      const col = client.db("teavie").collection("content");
      return fetchCategoryDiscover(col, slug, null);
    },
    [`category-discover-v2-${slug}`],
    { revalidate, tags: [`category-discover-${slug}`] }
  )();
}

export const CATEGORY_DISCOVER_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};
