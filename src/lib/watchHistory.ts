/** Client-only index of recently watched titles (newest first). */

import { loadWatchProgress } from "@/lib/watchProgress";

export const WATCH_HISTORY_VERSION = 1 as const;
export const WATCH_HISTORY_INDEX_KEY = `teavie.watch-history.v${WATCH_HISTORY_VERSION}`;
export const WATCH_HISTORY_MAX = 24;

export type WatchHistoryMediaType = "movie" | "tv";

export type WatchHistoryEntry = {
  catalogId: string;
  mediaType: WatchHistoryMediaType;
  lastWatchedAt: number;
  lastSeason: number;
  lastEpisode: number;
};

export const WATCH_HISTORY_CHANGED_EVENT = "teavie-watch-history-changed";

function readIndex(): WatchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCH_HISTORY_INDEX_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as Partial<{ v: number; entries: WatchHistoryEntry[] }>;
    if (data.v !== WATCH_HISTORY_VERSION || !Array.isArray(data.entries)) return [];
    return data.entries
      .filter(
        (e) =>
          e &&
          typeof e.catalogId === "string" &&
          e.catalogId.length > 0 &&
          (e.mediaType === "movie" || e.mediaType === "tv") &&
          Number.isFinite(Number(e.lastWatchedAt))
      )
      .map((e) => ({
        catalogId: e.catalogId,
        mediaType: e.mediaType,
        lastWatchedAt: Number(e.lastWatchedAt),
        lastSeason: Math.max(1, Math.floor(Number(e.lastSeason)) || 1),
        lastEpisode: Math.max(1, Math.floor(Number(e.lastEpisode)) || 1),
      }));
  } catch {
    return [];
  }
}

function writeIndex(entries: WatchHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      WATCH_HISTORY_INDEX_KEY,
      JSON.stringify({ v: WATCH_HISTORY_VERSION, entries })
    );
    window.dispatchEvent(new CustomEvent(WATCH_HISTORY_CHANGED_EVENT));
  } catch {
    /* quota / private mode */
  }
}

/** Record or bump a title in watch history (called when playback progress is saved). */
export function touchWatchHistory(
  catalogId: string,
  payload: {
    mediaType: WatchHistoryMediaType;
    lastSeason: number;
    lastEpisode: number;
  }
): void {
  const id = String(catalogId ?? "").trim();
  if (!id) return;

  const now = Date.now();
  const next: WatchHistoryEntry = {
    catalogId: id,
    mediaType: payload.mediaType,
    lastWatchedAt: now,
    lastSeason: Math.max(1, Math.floor(Number(payload.lastSeason)) || 1),
    lastEpisode: Math.max(1, Math.floor(Number(payload.lastEpisode)) || 1),
  };

  const prev = readIndex().filter((e) => e.catalogId !== id);
  writeIndex([next, ...prev].slice(0, WATCH_HISTORY_MAX));
}

/** Newest-first watch history; drops rows whose progress blob was removed. */
export function listWatchHistory(): WatchHistoryEntry[] {
  const index = readIndex();
  const kept: WatchHistoryEntry[] = [];
  for (const entry of index) {
    const progress = loadWatchProgress(entry.catalogId);
    if (!progress) continue;
    kept.push({
      ...entry,
      lastSeason: progress.lastSeason,
      lastEpisode: progress.lastEpisode,
    });
  }
  if (kept.length !== index.length) {
    writeIndex(kept);
  }
  return kept;
}

export function watchHistoryProgressLabel(entry: WatchHistoryEntry): string {
  if (entry.mediaType === "movie") return "Continue watching";
  if (entry.lastSeason <= 1) return `Episode ${entry.lastEpisode}`;
  return `S${entry.lastSeason} · E${entry.lastEpisode}`;
}
