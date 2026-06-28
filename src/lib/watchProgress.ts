/** Client-only persistence for TV watch position + per-episode watched set. */

export const WATCH_PROGRESS_VERSION = 1 as const;

export type WatchProgressPayload = {
  v: typeof WATCH_PROGRESS_VERSION;
  lastSeason: number;
  lastEpisode: number;
  /** Canonical keys `s{season}e{episode}` (1-based, TMDB season/episode). */
  watched: string[];
};

export function formatWatchEpKey(season: number, episode: number): string {
  return `s${season}e${episode}`;
}

export function watchProgressStorageKey(catalogId: string): string {
  return `teavie.watch.v${WATCH_PROGRESS_VERSION}:${catalogId}`;
}

export function loadWatchProgress(catalogId: string): WatchProgressPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(watchProgressStorageKey(catalogId));
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<WatchProgressPayload>;
    if (data.v !== WATCH_PROGRESS_VERSION) return null;
    const ls = Number(data.lastSeason);
    const le = Number(data.lastEpisode);
    if (!Number.isFinite(ls) || !Number.isFinite(le)) return null;
    const watched = Array.isArray(data.watched)
      ? data.watched.filter((x) => typeof x === "string")
      : [];
    return {
      v: WATCH_PROGRESS_VERSION,
      lastSeason: Math.max(1, Math.floor(ls)),
      lastEpisode: Math.max(1, Math.floor(le)),
      watched,
    };
  } catch {
    return null;
  }
}

export function saveWatchProgress(
  catalogId: string,
  payload: Omit<WatchProgressPayload, "v">
): void {
  if (typeof window === "undefined") return;
  try {
    const full: WatchProgressPayload = {
      v: WATCH_PROGRESS_VERSION,
      lastSeason: payload.lastSeason,
      lastEpisode: payload.lastEpisode,
      watched: payload.watched,
    };
    localStorage.setItem(watchProgressStorageKey(catalogId), JSON.stringify(full));
  } catch {
    /* quota / private mode */
  }
}

export function clearWatchProgress(catalogId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(watchProgressStorageKey(catalogId));
  } catch {
    /* quota / private mode */
  }
}
