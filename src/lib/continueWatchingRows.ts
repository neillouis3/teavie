import type { ContentItem } from "@/types/content";
import {
  repairWatchHistoryMediaType,
  type WatchHistoryEntry,
} from "@/lib/watchHistory";

export type ExploreHistoryRow = ContentItem & {
  progressLabel: string;
  lastSeason: number;
  lastEpisode: number;
};

/** True when two catalog ids refer to the same title (e.g. anime MAL aliases). */
export function catalogIdsMatch(
  catalogId: string,
  itemId: string | number
): boolean {
  const left = String(catalogId ?? "").trim();
  const right = String(itemId ?? "").trim();
  if (!left || !right) return false;
  if (left === right) return true;
  if (left === `anime_${right}` || right === `anime_${left}`) return true;
  return false;
}

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
    // The catalog knows the real media type; a stale entry would otherwise be
    // labelled (and linked) as the wrong kind of title.
    const resolved =
      item.type === "movie" || item.type === "tv" ? item.type : entry.mediaType;
    if (resolved !== entry.mediaType) {
      repairWatchHistoryMediaType(entry.catalogId, resolved);
    }
    rows.push({
      ...item,
      id: entry.catalogId,
      progressLabel: progressLabel({ ...entry, mediaType: resolved }),
      lastSeason: entry.lastSeason,
      lastEpisode: entry.lastEpisode,
    });
  }

  return rows;
}
