const STORAGE_KEY = "teavie-dub-unavailable-v2";

/** Re-check dub after this window — sources can add dubs later. */
export const DUB_UNAVAILABLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type CacheEntry = {
  key: string;
  expiresAt: number;
};

function cacheKey(malId: number, episode: number): string {
  return `${Math.floor(malId)}:${Math.max(1, Math.floor(episode))}`;
}

function readEntries(): CacheEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const now = Date.now();
    return parsed.filter(
      (entry): entry is CacheEntry =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as CacheEntry).key === "string" &&
        typeof (entry as CacheEntry).expiresAt === "number" &&
        (entry as CacheEntry).expiresAt > now
    );
  } catch {
    return [];
  }
}

function writeEntries(entries: CacheEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const now = Date.now();
    const valid = entries
      .filter((entry) => entry.expiresAt > now)
      .slice(-500);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
  } catch {
    /* ignore quota */
  }
}

export function isDubUnavailableCached(malId: number, episode: number): boolean {
  const key = cacheKey(malId, episode);
  return readEntries().some((entry) => entry.key === key);
}

export function cacheDubUnavailable(malId: number, episode: number): void {
  const key = cacheKey(malId, episode);
  const expiresAt = Date.now() + DUB_UNAVAILABLE_CACHE_TTL_MS;
  const entries = readEntries().filter((entry) => entry.key !== key);
  entries.push({ key, expiresAt });
  writeEntries(entries);
}

export function clearDubUnavailableCache(malId: number, episode: number): void {
  const key = cacheKey(malId, episode);
  const entries = readEntries().filter((entry) => entry.key !== key);
  writeEntries(entries);
}
