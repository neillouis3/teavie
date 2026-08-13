import { unstable_cache } from "next/cache";
import { loadPersonalizedExploreBundle } from "@/lib/api/personalizedRails";

const REVALIDATE_SEC = 900;

function preferencesCacheKey(preferences) {
  const categories = [...(preferences?.categories ?? [])].sort();
  const genres = [...(preferences?.genres ?? [])].sort();
  const languages = [...(preferences?.languages ?? [])].sort();
  return JSON.stringify({ categories, genres, languages });
}

function filterExcludedMovies(items, excludeMovieIds) {
  if (!Array.isArray(items) || excludeMovieIds.length === 0) return items;
  const exclude = new Set(excludeMovieIds.map(String));
  return items.filter(
    (item) => !(item?.type === "movie" && exclude.has(String(item.id)))
  );
}

function applyExcludeToBundle(bundle, excludeMovieIds) {
  if (!bundle || excludeMovieIds.length === 0) return bundle;
  return {
    ...bundle,
    recommended: filterExcludedMovies(bundle.recommended, excludeMovieIds),
    spotlight: filterExcludedMovies(bundle.spotlight, excludeMovieIds),
    popularMovies: filterExcludedMovies(bundle.popularMovies, excludeMovieIds),
    popularTv: filterExcludedMovies(bundle.popularTv, excludeMovieIds),
    newContent: filterExcludedMovies(bundle.newContent, excludeMovieIds),
    upcomingContent: filterExcludedMovies(bundle.upcomingContent, excludeMovieIds),
  };
}

/**
 * Cache personalized rails by preference profile (not watch history).
 * Watched-movie exclusions are applied after the cache read.
 */
export function getCachedPersonalizedExploreBundle(
  preferences,
  { limit = 24, recommendedOnly = false } = {}
) {
  const prefKey = preferencesCacheKey(preferences);
  return unstable_cache(
    async () =>
      loadPersonalizedExploreBundle(preferences, {
        limit,
        recommendedOnly,
      }),
    ["personalized-explore", prefKey, String(limit), recommendedOnly ? "rec" : "full"],
    { revalidate: REVALIDATE_SEC, tags: [`personalized-${prefKey}`] }
  )();
}

export function getCachedPersonalizedExploreBundleWithExclude(
  preferences,
  excludeMovieIds,
  options = {}
) {
  return getCachedPersonalizedExploreBundle(preferences, options).then(
    (bundle) => applyExcludeToBundle(bundle, excludeMovieIds)
  );
}

export const PERSONALIZED_CACHE_HEADERS = {
  "Cache-Control": "private, s-maxage=300, stale-while-revalidate=900",
};
