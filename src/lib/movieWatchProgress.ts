/** Client-only resume position for movies (Videasy progress param). */

const KEY_PREFIX = "teavie.movie.progress:";

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
  } catch {
    /* quota / private mode */
  }
}
