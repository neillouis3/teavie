import type { ContentItem } from "@/types/content";
import {
  repairWatchHistoryMediaType,
  type WatchHistoryEntry,
} from "@/lib/watchHistory";

export type ExploreHistoryRow = ContentItem & {
  progressLabel: string;
  lastSeason: number;
  lastEpisode: number;
  episodeStillPath?: string | null;
  episodeName?: string | null;
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

/**
 * Rows already fetched during this page load. Module state survives client-side
 * navigation and dies with the document, so the rail refreshes on a hard refresh
 * but not on back, forward, or moving between tabs.
 */
const sessionRows = new Map<string, ExploreHistoryRow[]>();
const sessionRowByCatalogId = new Map<string, ExploreHistoryRow>();

function catalogSignature(entries: WatchHistoryEntry[]): string {
  return entries
    .map((e) => `${e.mediaType}:${e.catalogId}`)
    .sort()
    .join("|");
}

function rememberSessionRows(rows: ExploreHistoryRow[]): void {
  for (const row of rows) {
    sessionRowByCatalogId.set(String(row.id), row);
  }
}

/** Reuse cards for the current entries; progress labels are reapplied per read. */
export function relabelRows(
  rows: ExploreHistoryRow[],
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): ExploreHistoryRow[] {
  const out: ExploreHistoryRow[] = [];
  for (const entry of entries) {
    const row = rows.find((candidate) =>
      catalogIdsMatch(entry.catalogId, candidate.id)
    );
    if (!row) continue;
    out.push({
      ...row,
      id: entry.catalogId,
      progressLabel: progressLabel(entry),
      lastSeason: entry.lastSeason,
      lastEpisode: entry.lastEpisode,
      episodeStillPath: row.episodeStillPath ?? null,
      episodeName: row.episodeName ?? null,
    });
  }
  return out;
}

function findSessionRow(catalogId: string): ExploreHistoryRow | undefined {
  const id = String(catalogId ?? "").trim();
  if (!id) return undefined;
  const direct = sessionRowByCatalogId.get(id);
  if (direct) return direct;
  for (const row of sessionRowByCatalogId.values()) {
    if (catalogIdsMatch(id, row.id)) return row;
  }
  return undefined;
}

function assembleSessionRows(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): ExploreHistoryRow[] | null {
  const rows: ExploreHistoryRow[] = [];
  for (const entry of entries) {
    const row = findSessionRow(entry.catalogId);
    if (!row) return null;
    rows.push(row);
  }
  return relabelRows(rows, entries, progressLabel);
}

/** Synchronous read of this page load's rows. Null means nothing fetched yet. */
export function peekContinueWatchingRows(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string
): ExploreHistoryRow[] | null {
  if (entries.length === 0) return [];
  const signature = catalogSignature(entries);
  const cached = sessionRows.get(signature);
  if (cached) return relabelRows(cached, entries, progressLabel);

  const assembled = assembleSessionRows(entries, progressLabel);
  if (assembled) {
    sessionRows.set(signature, assembled);
    return assembled;
  }
  return null;
}

/** Fetch poster/title rows for continue watching, once per page load. */
export async function fetchContinueWatchingRows(
  entries: WatchHistoryEntry[],
  progressLabel: (entry: WatchHistoryEntry) => string,
  options: { force?: boolean } = {}
): Promise<ExploreHistoryRow[]> {
  if (entries.length === 0) return [];

  const signature = catalogSignature(entries);
  if (!options.force) {
    const cached = sessionRows.get(signature);
    if (cached) return relabelRows(cached, entries, progressLabel);
  }

  const res = await fetch("/api/catalog/history", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      entries: entries.map((e) => ({
        catalogId: e.catalogId,
        mediaType: e.mediaType,
        lastSeason: e.lastSeason,
        lastEpisode: e.lastEpisode,
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
      episodeStillPath:
        "episode_still_path" in item && typeof item.episode_still_path === "string"
          ? item.episode_still_path
          : null,
      episodeName:
        "episode_name" in item && typeof item.episode_name === "string"
          ? item.episode_name
          : null,
    });
  }

  rememberSessionRows(rows);
  sessionRows.set(signature, rows);
  return rows;
}
