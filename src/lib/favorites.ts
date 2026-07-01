/** Guest-only favorites in localStorage. Signed-in users use Supabase via API. */

export const FAVORITES_VERSION = 1 as const;
export const FAVORITES_STORAGE_KEY = `teavie.favorites.v${FAVORITES_VERSION}`;
export const FAVORITES_MAX = 96;
export const FAVORITES_CHANGED_EVENT = "teavie-favorites-changed";

export type FavoriteEntry = {
  catalogId: string;
  mediaType: "movie" | "tv";
  addedAt: number;
};

function readEntries(): FavoriteEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as Partial<{ v: number; entries: FavoriteEntry[] }>;
    if (data.v !== FAVORITES_VERSION || !Array.isArray(data.entries)) return [];
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

function writeEntries(entries: FavoriteEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      FAVORITES_STORAGE_KEY,
      JSON.stringify({ v: FAVORITES_VERSION, entries })
    );
    window.dispatchEvent(new CustomEvent(FAVORITES_CHANGED_EVENT));
  } catch {
    /* quota / private mode */
  }
}

export function listFavorites(): FavoriteEntry[] {
  return readEntries().sort((a, b) => b.addedAt - a.addedAt);
}

export function isInFavorites(catalogId: string): boolean {
  const id = String(catalogId ?? "").trim();
  if (!id) return false;
  return readEntries().some((e) => e.catalogId === id);
}

export function addToFavorites(catalogId: string, mediaType: "movie" | "tv"): void {
  const id = String(catalogId ?? "").trim();
  if (!id) return;
  const prev = readEntries().filter((e) => e.catalogId !== id);
  writeEntries(
    [{ catalogId: id, mediaType, addedAt: Date.now() }, ...prev].slice(0, FAVORITES_MAX)
  );
}

export function removeFromFavorites(catalogId: string): void {
  const id = String(catalogId ?? "").trim();
  if (!id) return;
  writeEntries(readEntries().filter((e) => e.catalogId !== id));
}
