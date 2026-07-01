/** Client-only watch later list (guests). Logged-in users sync via API. */

export const WATCH_LATER_VERSION = 1 as const;
export const WATCH_LATER_STORAGE_KEY = `teavie.watch-later.v${WATCH_LATER_VERSION}`;
export const WATCH_LATER_MAX = 48;
export const WATCH_LATER_CHANGED_EVENT = "teavie-watch-later-changed";

export type WatchLaterEntry = {
  catalogId: string;
  mediaType: "movie" | "tv";
  addedAt: number;
};

function readEntries(): WatchLaterEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCH_LATER_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as Partial<{ v: number; entries: WatchLaterEntry[] }>;
    if (data.v !== WATCH_LATER_VERSION || !Array.isArray(data.entries)) return [];
    return data.entries
      .filter(
        (e) =>
          e &&
          typeof e.catalogId === "string" &&
          e.catalogId.length > 0 &&
          (e.mediaType === "movie" || e.mediaType === "tv")
      )
      .map((e) => ({
        catalogId: e.catalogId,
        mediaType: e.mediaType,
        addedAt: Number.isFinite(Number(e.addedAt)) ? Number(e.addedAt) : Date.now(),
      }));
  } catch {
    return [];
  }
}

function writeEntries(entries: WatchLaterEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      WATCH_LATER_STORAGE_KEY,
      JSON.stringify({ v: WATCH_LATER_VERSION, entries })
    );
    window.dispatchEvent(new CustomEvent(WATCH_LATER_CHANGED_EVENT));
  } catch {
    /* quota / private mode */
  }
}

export function listWatchLater(): WatchLaterEntry[] {
  return readEntries().sort((a, b) => b.addedAt - a.addedAt);
}

export function isInWatchLater(catalogId: string): boolean {
  const id = String(catalogId ?? "").trim();
  if (!id) return false;
  return readEntries().some((e) => e.catalogId === id);
}

export function addToWatchLater(
  catalogId: string,
  mediaType: "movie" | "tv"
): void {
  const id = String(catalogId ?? "").trim();
  if (!id) return;
  const prev = readEntries().filter((e) => e.catalogId !== id);
  writeEntries(
    [{ catalogId: id, mediaType, addedAt: Date.now() }, ...prev].slice(0, WATCH_LATER_MAX)
  );
}

export function removeFromWatchLater(catalogId: string): void {
  const id = String(catalogId ?? "").trim();
  if (!id) return;
  writeEntries(readEntries().filter((e) => e.catalogId !== id));
}

export function replaceWatchLater(entries: WatchLaterEntry[]): void {
  writeEntries(entries.slice(0, WATCH_LATER_MAX));
}
