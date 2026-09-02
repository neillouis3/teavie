import { unstable_cache } from "next/cache";
import { loadCatalogDiscoverRails } from "@/lib/api/catalogDiscoverRails";
import { loadPopularGenres } from "@/lib/api/popularGenres";
import { loadDiscoverFeed } from "@/lib/api/discoverFeed";

const DISCOVER_REVALIDATE_SEC = 3600;

export const EXPLORE_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export function getCachedExplorePayload() {
  return unstable_cache(
    async () => {
      const [discover, genres, feed] = await Promise.all([
        loadCatalogDiscoverRails(),
        loadPopularGenres(false),
        loadDiscoverFeed(),
      ]);
      return { discover, genres, feed };
    },
    ["explore-hub-v5"],
    { revalidate: DISCOVER_REVALIDATE_SEC, tags: ["explore-hub"] }
  )();
}
