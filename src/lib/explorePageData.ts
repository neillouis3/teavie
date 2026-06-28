import type { ContentItem } from "@/types/content";
import type { CatalogGenreRow } from "@/components/genre/genreTileShared";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import type { WatchHistoryEntry } from "@/lib/watchHistory";

export type TmdbDiscoverPayload = {
  trendingMovies: ContentItem[];
  trendingTv: ContentItem[];
  popularMovies: ContentItem[];
  popularTv: ContentItem[];
};

export const EXPLORE_DISCOVER_CACHE_KEY = "teavie.cache.explore.discover.v1";
export const EXPLORE_GENRES_CACHE_KEY = "teavie.cache.explore.genres.v1";
const EXPLORE_HISTORY_CACHE_PREFIX = "teavie.cache.explore.history.v1:";

const EMPTY_DISCOVER: TmdbDiscoverPayload = {
  trendingMovies: [],
  trendingTv: [],
  popularMovies: [],
  popularTv: [],
};

function historyCacheKey(entries: WatchHistoryEntry[]): string {
  const sig = entries
    .map((e) => `${e.mediaType}:${e.catalogId}`)
    .sort()
    .join("|");
  return `${EXPLORE_HISTORY_CACHE_PREFIX}${sig || "empty"}`;
}

export type ExploreHistoryRow = ContentItem & { progressLabel: string };

export type ExplorePagePayload = {
  discover: TmdbDiscoverPayload;
  genres: CatalogGenreRow[];
  historyRows: ExploreHistoryRow[];
};

export async function fetchExploreDiscover(): Promise<TmdbDiscoverPayload> {
  const cached = readClientDayCache<TmdbDiscoverPayload>(EXPLORE_DISCOVER_CACHE_KEY);
  if (cached) return cached;

  try {
    const res = await fetch("/api/tmdb/discover");
    if (!res.ok) return EMPTY_DISCOVER;
    const json = await res.json();
    const data: TmdbDiscoverPayload = {
      trendingMovies: json.trendingMovies ?? [],
      trendingTv: json.trendingTv ?? [],
      popularMovies: json.popularMovies ?? [],
      popularTv: json.popularTv ?? [],
    };
    writeClientDayCache(EXPLORE_DISCOVER_CACHE_KEY, data);
    return data;
  } catch {
    return EMPTY_DISCOVER;
  }
}

export async function fetchExploreGenres(): Promise<CatalogGenreRow[]> {
  const cached = readClientDayCache<CatalogGenreRow[]>(EXPLORE_GENRES_CACHE_KEY);
  if (cached) return cached;

  try {
    const res = await fetch("/api/genres/popular");
    if (!res.ok) return [];
    const json = await res.json();
    const genres = Array.isArray(json.genres) ? json.genres : [];
    writeClientDayCache(EXPLORE_GENRES_CACHE_KEY, genres);
    return genres;
  } catch {
    return [];
  }
}

export async function fetchExploreHistoryRows(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): Promise<ExploreHistoryRow[]> {
  if (entries.length === 0) return [];

  const cacheKey = historyCacheKey(entries);
  const cached = readClientDayCache<ExploreHistoryRow[]>(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch("/api/catalog/history", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        entries: entries.map((e) => ({
          catalogId: e.catalogId,
          mediaType: e.mediaType,
        })),
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: ContentItem[] };
    const byId = new Map((json.items ?? []).map((item) => [String(item.id), item]));
    const rows: ExploreHistoryRow[] = [];
    for (const entry of entries) {
      const item = byId.get(entry.catalogId);
      if (!item) continue;
      rows.push({
        ...item,
        id: entry.catalogId,
        progressLabel: progressLabel(entry),
      });
    }
    writeClientDayCache(cacheKey, rows);
    return rows;
  } catch {
    return [];
  }
}

export async function loadExplorePagePayload(
  historyEntries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): Promise<ExplorePagePayload> {
  const [discover, genres, historyRows] = await Promise.all([
    fetchExploreDiscover(),
    fetchExploreGenres(),
    fetchExploreHistoryRows(historyEntries, progressLabel),
  ]);
  return { discover, genres, historyRows };
}
