/** Client-only index of recently watched titles (newest first). */

import { formatWatchEpKey, loadWatchProgress, saveWatchProgress, clearWatchProgress } from "@/lib/watchProgress";
import { formatHeroRuntime } from "@/lib/formatRelease";

export const WATCH_HISTORY_VERSION = 1 as const;
export const WATCH_HISTORY_INDEX_KEY = `teavie.watch-history.v${WATCH_HISTORY_VERSION}`;
export const WATCH_HISTORY_LOG_KEY = `teavie.watch-history-log.v${WATCH_HISTORY_VERSION}`;
export const WATCH_HISTORY_DISMISSED_KEY = `teavie.watch-history-dismissed.v${WATCH_HISTORY_VERSION}`;
export const WATCH_HISTORY_MAX = 24;
export const WATCH_HISTORY_LOG_MAX = 100;
/** Remove continue-watching rows not opened in this window. */
export const WATCH_HISTORY_TTL_MS = 3 * 24 * 60 * 60 * 1000;
/** Minimum playback seconds before a title can enter Continue watching. */
export const WATCH_HISTORY_MIN_PLAY_SECONDS = 5;

export type WatchHistoryMediaType = "movie" | "tv";

export type WatchHistoryEntry = {
  catalogId: string;
  mediaType: WatchHistoryMediaType;
  lastWatchedAt: number;
  lastSeason: number;
  lastEpisode: number;
};

export const WATCH_HISTORY_CHANGED_EVENT = "teavie-watch-history-changed";
export const WATCH_HISTORY_LOG_CHANGED_EVENT = "teavie-watch-history-log-changed";

function normalizeEntry(e: WatchHistoryEntry): WatchHistoryEntry {
  return {
    catalogId: e.catalogId,
    mediaType: e.mediaType,
    lastWatchedAt: Number(e.lastWatchedAt),
    lastSeason: Math.max(1, Math.floor(Number(e.lastSeason)) || 1),
    lastEpisode: Math.max(1, Math.floor(Number(e.lastEpisode)) || 1),
  };
}

function parseEntries(raw: string | null): WatchHistoryEntry[] {
  if (!raw) return [];
  try {
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
      .map(normalizeEntry);
  } catch {
    return [];
  }
}

function readIndex(): WatchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return parseEntries(localStorage.getItem(WATCH_HISTORY_INDEX_KEY));
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

function readLogRaw(): WatchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return parseEntries(localStorage.getItem(WATCH_HISTORY_LOG_KEY));
  } catch {
    return [];
  }
}

function writeLog(entries: WatchHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      WATCH_HISTORY_LOG_KEY,
      JSON.stringify({ v: WATCH_HISTORY_VERSION, entries })
    );
    window.dispatchEvent(new CustomEvent(WATCH_HISTORY_LOG_CHANGED_EVENT));
    window.dispatchEvent(new CustomEvent(WATCH_HISTORY_CHANGED_EVENT));
  } catch {
    /* quota / private mode */
  }
}

function readDismissedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(WATCH_HISTORY_DISMISSED_KEY);
    if (!raw) return new Set();
    const data = JSON.parse(raw) as Partial<{ v: number; ids: string[] }>;
    if (data.v !== WATCH_HISTORY_VERSION || !Array.isArray(data.ids)) return new Set();
    return new Set(data.ids.filter((id) => typeof id === "string" && id.length > 0));
  } catch {
    return new Set();
  }
}

function writeDismissedIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      WATCH_HISTORY_DISMISSED_KEY,
      JSON.stringify({ v: WATCH_HISTORY_VERSION, ids: [...ids] })
    );
  } catch {
    /* quota / private mode */
  }
}

/** User removed a title from Continue watching — do not auto-restore from log/sync. */
export function isDismissedFromContinue(catalogId: string): boolean {
  const id = String(catalogId ?? "").trim();
  if (!id) return false;
  return readDismissedIds().has(id);
}

function dismissFromContinue(catalogId: string): void {
  const id = String(catalogId ?? "").trim();
  if (!id) return;
  const next = readDismissedIds();
  next.add(id);
  writeDismissedIds(next);
}

function undismissFromContinue(catalogId: string): void {
  const id = String(catalogId ?? "").trim();
  if (!id) return;
  const next = readDismissedIds();
  if (!next.delete(id)) return;
  writeDismissedIds(next);
}

function isEligibleForContinue(entry: WatchHistoryEntry, now = Date.now()): boolean {
  if (isDismissedFromContinue(entry.catalogId)) return false;
  return now - entry.lastWatchedAt < WATCH_HISTORY_TTL_MS;
}

function upsertLogEntry(entry: WatchHistoryEntry): void {
  const prev = readLogRaw().filter((e) => e.catalogId !== entry.catalogId);
  writeLog([entry, ...prev].slice(0, WATCH_HISTORY_LOG_MAX));
}

/** Durable watch history (no TTL) for Activity + recommendation exclusion. */
export function listWatchHistoryLog(): WatchHistoryEntry[] {
  let log = readLogRaw();
  if (log.length === 0) {
    const seeded = readIndex();
    if (seeded.length > 0) {
      writeLog(seeded.slice(0, WATCH_HISTORY_LOG_MAX));
      log = seeded.slice(0, WATCH_HISTORY_LOG_MAX);
    }
  }
  return log;
}

/** Merge remote/local log entries, keeping the newest per catalog id. */
export function mergeWatchHistoryLog(entries: WatchHistoryEntry[]): WatchHistoryEntry[] {
  const byId = new Map(listWatchHistoryLog().map((e) => [e.catalogId, e]));
  for (const raw of entries) {
    const entry = normalizeEntry(raw);
    if (!entry.catalogId) continue;
    const prev = byId.get(entry.catalogId);
    if (!prev || entry.lastWatchedAt >= prev.lastWatchedAt) {
      byId.set(entry.catalogId, entry);
    }
  }
  const merged = [...byId.values()]
    .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)
    .slice(0, WATCH_HISTORY_LOG_MAX);
  writeLog(merged);

  const now = Date.now();
  const freshContinue = merged.filter((entry) => isEligibleForContinue(entry, now));
  if (freshContinue.length > 0) {
    const byId = new Map<string, WatchHistoryEntry>();
    for (const entry of [...readIndex(), ...freshContinue]) {
      if (isDismissedFromContinue(entry.catalogId)) continue;
      const prev = byId.get(entry.catalogId);
      if (!prev || entry.lastWatchedAt >= prev.lastWatchedAt) {
        byId.set(entry.catalogId, entry);
      }
    }
    writeIndex(
      [...byId.values()]
        .sort((a, b) => b.lastWatchedAt - a.lastWatchedAt)
        .slice(0, WATCH_HISTORY_MAX)
    );
  }

  return merged;
}

/** Catalog ids for movies the user has already watched. */
export function listWatchedMovieCatalogIds(): string[] {
  return listWatchHistoryLog()
    .filter((e) => e.mediaType === "movie")
    .map((e) => e.catalogId);
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

  undismissFromContinue(id);
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
  upsertLogEntry(next);
}

/** Mark a movie as recently watched (continue-watching rail). */
export function recordMovieInWatchHistory(catalogId: string): void {
  const id = String(catalogId ?? "").trim();
  if (!id) return;
  saveWatchProgress(id, {
    lastSeason: 1,
    lastEpisode: 1,
    watched: [formatWatchEpKey(1, 1)],
  });
  touchWatchHistory(id, {
    mediaType: "movie",
    lastSeason: 1,
    lastEpisode: 1,
  });
}

/** Newest-first continue watching; drops TTL-expired rows only. */
export function listWatchHistory(): WatchHistoryEntry[] {
  const now = Date.now();
  let index = readIndex();

  // Recover if the continue index was wiped accidentally (not user-dismissed rows).
  if (index.length === 0) {
    const recovered = listWatchHistoryLog()
      .filter((e) => isEligibleForContinue(e, now))
      .slice(0, WATCH_HISTORY_MAX);
    if (recovered.length > 0) {
      writeIndex(recovered);
      index = recovered;
    }
  }

  const kept: WatchHistoryEntry[] = [];
  for (const entry of index) {
    if (!isEligibleForContinue(entry, now)) continue;
    const progress = loadWatchProgress(entry.catalogId);
    kept.push({
      ...entry,
      lastSeason: progress?.lastSeason ?? entry.lastSeason,
      lastEpisode: progress?.lastEpisode ?? entry.lastEpisode,
    });
  }
  if (kept.length !== index.length) {
    writeIndex(kept);
  }
  return kept;
}

/** Remove a title from continue watching and clear saved progress. Keeps durable log. */
export function removeFromWatchHistory(catalogId: string): void {
  const id = String(catalogId ?? "").trim();
  if (!id) return;
  dismissFromContinue(id);
  const next = readIndex().filter((e) => e.catalogId !== id);
  writeIndex(next);
  clearWatchProgress(id);
}

/** Remove a title from durable watch history (and continue watching). */
export function removeFromWatchHistoryLog(catalogId: string): void {
  const id = String(catalogId ?? "").trim();
  if (!id) return;
  writeLog(readLogRaw().filter((e) => e.catalogId !== id));
  undismissFromContinue(id);
  writeIndex(readIndex().filter((e) => e.catalogId !== id));
  clearWatchProgress(id);
}

export function watchHistoryProgressLabel(entry: WatchHistoryEntry): string {
  if (entry.mediaType === "movie") return "Continue watching";
  if (entry.lastSeason <= 1) return `Episode ${entry.lastEpisode}`;
  return `S${entry.lastSeason} · E${entry.lastEpisode}`;
}

export function watchHistoryLogLabel(entry: WatchHistoryEntry): string {
  if (entry.mediaType === "movie") return "Watched";
  if (entry.lastSeason <= 1) return `Episode ${entry.lastEpisode}`;
  return `S${entry.lastSeason} · E${entry.lastEpisode}`;
}

/** Meta chips for continue-watching cards (pill row above title). */
export function watchHistoryMetaChips(
  entry: Pick<WatchHistoryEntry, "mediaType" | "lastSeason" | "lastEpisode">,
  seasonAmount: number,
  runtimeSeconds?: number
): string[] {
  if (entry.mediaType === "movie") {
    const runtime = formatHeroRuntime(runtimeSeconds);
    return runtime ? [runtime] : [];
  }
  const season = Math.max(1, Math.floor(Number(entry.lastSeason)) || 1);
  const episode = Math.max(1, Math.floor(Number(entry.lastEpisode)) || 1);
  const seasons = seasonAmount > 0 ? seasonAmount : 1;
  if (seasons > 1) {
    return [`S${season}`, `E${episode}`];
  }
  return [`Episode ${episode}`];
}
