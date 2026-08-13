import { unstable_cache } from "next/cache";
import clientPromise from "@/lib/mongo";
import {
  fetchCategoryDiscover,
  fetchCategoryHero,
  fetchCategoryRails,
  fetchCategoryTopRated,
  fetchCategoryNewEpisodes,
  fetchCategoryGenreTiles,
} from "@/lib/categoryDiscover";

const DISCOVER_REVALIDATE_SEC = 3600;
const ANIME_DISCOVER_REVALIDATE_SEC = 900;
const GENRE_TILES_REVALIDATE_SEC = 7200;

function discoverRevalidate(slug) {
  return slug === "anime" ? ANIME_DISCOVER_REVALIDATE_SEC : DISCOVER_REVALIDATE_SEC;
}

async function getContentCollection() {
  const client = await clientPromise;
  return client.db("teavie").collection("content");
}

/**
 * Server-side cache for category hub payloads (anime / kdrama landing pages).
 * Preference-filtered POST requests bypass this and hit Mongo directly.
 */
export function getCachedCategoryDiscover(slug) {
  return unstable_cache(
    async () => {
      const col = await getContentCollection();
      return fetchCategoryDiscover(col, slug, null);
    },
    [`category-discover-v3-${slug}`],
    { revalidate: discoverRevalidate(slug), tags: [`category-discover-${slug}`] }
  )();
}

export function getCachedCategoryHero(slug) {
  return unstable_cache(
    async () => {
      const col = await getContentCollection();
      return fetchCategoryHero(col, slug, null);
    },
    [`category-discover-hero-v2-${slug}`],
    { revalidate: discoverRevalidate(slug), tags: [`category-discover-${slug}`] }
  )();
}

export function getCachedCategoryRails(slug) {
  return unstable_cache(
    async () => {
      const col = await getContentCollection();
      return fetchCategoryRails(col, slug, null);
    },
    [`category-discover-rails-v3-${slug}`],
    { revalidate: discoverRevalidate(slug), tags: [`category-discover-${slug}`] }
  )();
}

export function getCachedCategoryTopRated(slug) {
  return unstable_cache(
    async () => {
      const col = await getContentCollection();
      return fetchCategoryTopRated(col, slug, null);
    },
    [`category-discover-top-rated-v1-${slug}`],
    { revalidate: discoverRevalidate(slug), tags: [`category-discover-${slug}`] }
  )();
}

export function getCachedCategoryNewEpisodes(slug) {
  return unstable_cache(
    async () => {
      const col = await getContentCollection();
      return fetchCategoryNewEpisodes(col, slug, null);
    },
    [`category-discover-new-episodes-v1-${slug}`],
    { revalidate: discoverRevalidate(slug), tags: [`category-discover-${slug}`] }
  )();
}

export function getCachedCategoryGenreTiles(slug) {
  return unstable_cache(
    async () => {
      const col = await getContentCollection();
      return fetchCategoryGenreTiles(col, slug, null);
    },
    [`category-discover-genres-v1-${slug}`],
    {
      revalidate: GENRE_TILES_REVALIDATE_SEC,
      tags: [`category-discover-${slug}`],
    }
  )();
}

export const CATEGORY_DISCOVER_CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};
