/** Client localStorage cache invalidated at UTC midnight. */

export const CLIENT_DAY_CACHE_VERSION = 1 as const;

type DayCacheEnvelope<T> = {
  v: typeof CLIENT_DAY_CACHE_VERSION;
  day: string;
  data: T;
};

export function clientDayCacheKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function readClientDayCache<T>(storageKey: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DayCacheEnvelope<T>>;
    if (parsed.v !== CLIENT_DAY_CACHE_VERSION) return null;
    if (parsed.day !== clientDayCacheKey()) return null;
    if (parsed.data === undefined) return null;
    return parsed.data as T;
  } catch {
    return null;
  }
}

export function writeClientDayCache<T>(storageKey: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: DayCacheEnvelope<T> = {
      v: CLIENT_DAY_CACHE_VERSION,
      day: clientDayCacheKey(),
      data,
    };
    localStorage.setItem(storageKey, JSON.stringify(envelope));
  } catch {
    /* quota / private mode */
  }
}
