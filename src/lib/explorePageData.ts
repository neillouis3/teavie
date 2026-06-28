import type { ContentItem } from "@/types/content";
import type { CatalogGenreRow } from "@/components/genre/genreTileShared";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import type { WatchHistoryEntry } from "@/lib/watchHistory";
import {
  fetchExploreBundle,
  type TmdbDiscoverPayload,
  type ExploreBundle,
} from "@/lib/pageDataCache";

export type { TmdbDiscoverPayload };

const EXPLORE_HISTORY_CACHE_PREFIX = "teavie.cache.explore.history.v1:";

export type ExploreHistoryRow = ContentItem & {
  progressLabel: string;
  lastSeason: number;
  lastEpisode: number;
};

export type ExplorePagePayload = {
  discover: TmdbDiscoverPayload;
  genres: CatalogGenreRow[];
  historyRows: ExploreHistoryRow[];
};

function historyCacheKey(entries: WatchHistoryEntry[]): string {
  const sig = entries
    .map((e) => `${e.mediaType}:${e.catalogId}`)
    .sort()
    .join("|");
  return `${EXPLORE_HISTORY_CACHE_PREFIX}${sig || "empty"}`;
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
        lastSeason: entry.lastSeason,
        lastEpisode: entry.lastEpisode,
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
  const [bundle, historyRows] = await Promise.all([
    fetchExploreBundle(),
    fetchExploreHistoryRows(historyEntries, progressLabel),
  ]);
  return {
    discover: bundle.discover,
    genres: bundle.genres,
    historyRows,
  };
}

export { fetchExploreBundle, type ExploreBundle };
