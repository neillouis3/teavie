/** Client-only persistence for TV watch position + per-episode watched set. */

export const WATCH_PROGRESS_VERSION = 1 as const;

export type WatchProgressPayload = {
  v: typeof WATCH_PROGRESS_VERSION;
  lastSeason: number;
  lastEpisode: number;
  /** Canonical keys `s{season}e{episode}` (1-based, TMDB season/episode). */
  watched: string[];
  /** Resume position in seconds per episode key. */
  positions?: Record<string, number>;
};

export function formatWatchEpKey(season: number, episode: number): string {
  return `s${season}e${episode}`;
}

export function watchProgressStorageKey(catalogId: string): string {
  return `teavie.watch.v${WATCH_PROGRESS_VERSION}:${catalogId}`;
}

let tvProgressSyncDelegate:
  | ((catalogId: string, payload: Omit<WatchProgressPayload, "v">) => void)
  | null = null;

export function setTvProgressSyncDelegate(
  fn: ((catalogId: string, payload: Omit<WatchProgressPayload, "v">) => void) | null
): void {
  tvProgressSyncDelegate = fn;
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
    const positions =
      data.positions && typeof data.positions === "object"
        ? Object.fromEntries(
            Object.entries(data.positions).filter(
              ([k, v]) => typeof k === "string" && Number.isFinite(Number(v)) && Number(v) >= 0
            )
          )
        : undefined;
    return {
      v: WATCH_PROGRESS_VERSION,
      lastSeason: Math.max(1, Math.floor(ls)),
      lastEpisode: Math.max(1, Math.floor(le)),
      watched,
      positions,
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
    const existing = loadWatchProgress(catalogId);
    const full: WatchProgressPayload = {
      v: WATCH_PROGRESS_VERSION,
      lastSeason: payload.lastSeason,
      lastEpisode: payload.lastEpisode,
      watched: payload.watched,
      positions: payload.positions ?? existing?.positions,
    };
    localStorage.setItem(watchProgressStorageKey(catalogId), JSON.stringify(full));
    tvProgressSyncDelegate?.(catalogId, {
      lastSeason: full.lastSeason,
      lastEpisode: full.lastEpisode,
      watched: full.watched,
      positions: full.positions,
    });
  } catch {
    /* quota / private mode */
  }
}

export function saveEpisodePlaybackPosition(
  catalogId: string,
  season: number,
  episode: number,
  seconds: number
): void {
  if (typeof window === "undefined") return;
  const sec = Math.max(0, Math.floor(Number(seconds)) || 0);
  const existing = loadWatchProgress(catalogId);
  const key = formatWatchEpKey(season, episode);
  const positions = { ...(existing?.positions ?? {}), [key]: sec };
  saveWatchProgress(catalogId, {
    lastSeason: existing?.lastSeason ?? season,
    lastEpisode: existing?.lastEpisode ?? episode,
    watched: existing?.watched ?? [],
    positions,
  });
}

export function loadEpisodePlaybackPosition(
  catalogId: string,
  season: number,
  episode: number
): number {
  const saved = loadWatchProgress(catalogId);
  const key = formatWatchEpKey(season, episode);
  const sec = saved?.positions?.[key];
  return Number.isFinite(Number(sec)) && Number(sec) > 0 ? Math.floor(Number(sec)) : 0;
}

export function clearWatchProgress(catalogId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(watchProgressStorageKey(catalogId));
  } catch {
    /* quota / private mode */
  }
}
