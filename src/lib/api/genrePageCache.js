import { unstable_cache } from "next/cache";
import { loadGenrePage } from "@/lib/api/genreRail";

const GENRE_PAGE_REVALIDATE_SEC = 3600;

export function getCachedGenrePage(slug, type, limit, part = null) {
  const partKey = part ?? "full";
  return unstable_cache(
    async () => loadGenrePage(slug, type, limit, null, part),
    [`genre-page-v1-${slug}-${type}-${limit}-${partKey}`],
    {
      revalidate: GENRE_PAGE_REVALIDATE_SEC,
      tags: [`genre-page-${slug}`],
    }
  )();
}

export const GENRE_PAGE_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};
