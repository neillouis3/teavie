/** Client-only resume position for movies. */

const KEY_PREFIX = "teavie.movie.progress:";

let movieProgressSyncDelegate:
  | ((catalogId: string, seconds: number) => void)
  | null = null;

let moviePlaybackHistoryDelegate:
  | ((catalogId: string, seconds: number) => void)
  | null = null;

export function setMovieProgressSyncDelegate(
  fn: ((catalogId: string, seconds: number) => void) | null
): void {
  movieProgressSyncDelegate = fn;
}

export function setMoviePlaybackHistoryDelegate(
  fn: ((catalogId: string, seconds: number) => void) | null
): void {
  moviePlaybackHistoryDelegate = fn;
}

export function movieProgressStorageKey(catalogId: string): string {
  return `${KEY_PREFIX}${catalogId}`;
}

export function loadMoviePlaybackPosition(catalogId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(movieProgressStorageKey(catalogId));
    const sec = Number(raw);
    return Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  } catch {
    return 0;
  }
}

export function saveMoviePlaybackPosition(catalogId: string, seconds: number): void {
  if (typeof window === "undefined") return;
  const sec = Math.max(0, Math.floor(Number(seconds)) || 0);
  try {
    if (sec <= 0) {
      localStorage.removeItem(movieProgressStorageKey(catalogId));
      return;
    }
    localStorage.setItem(movieProgressStorageKey(catalogId), String(sec));
    movieProgressSyncDelegate?.(catalogId, sec);
    moviePlaybackHistoryDelegate?.(catalogId, sec);
  } catch {
    /* quota / private mode */
  }
}
