import { catalogTodayIsoUtc } from "./catalogQuery.js";

function anilistStartDateToYmd(startDate) {
  if (!startDate || typeof startDate !== "object") return null;
  const y = startDate.year;
  if (typeof y !== "number" || !Number.isFinite(y) || y <= 0) return null;
  const m =
    typeof startDate.month === "number" && startDate.month > 0
      ? String(startDate.month).padStart(2, "0")
      : "01";
  const d =
    typeof startDate.day === "number" && startDate.day > 0
      ? String(startDate.day).padStart(2, "0")
      : "01";
  return `${y}-${m}-${d}`;
}

/** Best YYYY-MM-DD for an anime catalog row or show payload. */
export function animeReleaseDateYmdFromDoc(doc) {
  const direct = doc?.first_air_date ?? doc?.release_date ?? null;
  if (typeof direct === "string" && direct.trim().length >= 10) {
    return direct.trim().slice(0, 10);
  }
  return anilistStartDateToYmd(doc?.anilist?.startDate) ?? null;
}

export function isAnimeNotYetAiredStatus(status) {
  const s = String(status ?? "").trim().toLowerCase();
  return s.includes("not yet aired") || s.includes("not yet released");
}

export function isAnimeCatalogDoc(doc) {
  const id = String(doc?.id ?? "");
  return id.startsWith("anime_") || doc?.is_anime === true;
}

/**
 * True when an anime catalog row should appear in browse / recommendation rails.
 * Rows with no date and no explicit "not yet aired" marker stay visible (legacy catalog).
 */
export function isAnimeCatalogDocReleased(doc, todayIso = catalogTodayIsoUtc()) {
  if (!doc || !isAnimeCatalogDoc(doc)) return true;

  if (isAnimeNotYetAiredStatus(doc.status)) return false;
  if (doc.anilist?.status === "NOT_YET_RELEASED") return false;

  const tags = doc.tags;
  if (Array.isArray(tags)) {
    for (const tag of tags) {
      if (String(tag).toLowerCase().includes("not yet aired")) return false;
    }
  }

  const ymd = animeReleaseDateYmdFromDoc(doc);
  if (!ymd) return true;
  return ymd <= todayIso;
}

/**
 * TV / anime watch page: may episodes play yet?
 * Non-anime keeps the old lenient rule (missing date → treat as released).
 */
export function catalogTvPremiered(item, todayIso = catalogTodayIsoUtc()) {
  if (!item) return false;
  if (isAnimeCatalogDoc(item)) return isAnimeCatalogDocReleased(item, todayIso);

  const d = String(item.first_air_date ?? "").trim();
  if (d.length < 10) return true;
  return d.slice(0, 10) <= todayIso;
}
