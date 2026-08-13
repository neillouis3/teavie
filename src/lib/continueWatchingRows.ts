import type { ContentItem } from "@/types/content";
import type { WatchHistoryEntry } from "@/lib/watchHistory";
import { catalogIdsMatch } from "@/lib/explorePageData";

export type ExploreHistoryRow = ContentItem & {
  progressLabel: string;
  lastSeason: number;
  lastEpisode: number;
};

/** Fetch poster/title rows for continue watching — no client cache. */
export async function fetchContinueWatchingRows(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): Promise<ExploreHistoryRow[]> {
  if (entries.length === 0) return [];

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

  if (!res.ok) {
    throw new Error(`catalog/history ${res.status}`);
  }

  const json = (await res.json()) as { items?: ContentItem[] };
  const items = json.items ?? [];
  const rows: ExploreHistoryRow[] = [];

  for (const entry of entries) {
    const item = items.find((row) => catalogIdsMatch(entry.catalogId, row.id));
    if (!item) continue;
    rows.push({
      ...item,
      id: entry.catalogId,
      progressLabel: progressLabel(entry),
      lastSeason: entry.lastSeason,
      lastEpisode: entry.lastEpisode,
    });
  }

  return rows;
}
