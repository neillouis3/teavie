/**
 * Map a `content` collection document to a ContentItem-style payload for rails/cards.
 */
import { catalogPopularityScore } from "@/lib/catalogPopularity";

/** YYYY-MM-DD or null from mixed TMDB / catalog date fields. */
export function catalogDocReleaseDateString(doc) {
  const rawDate =
    doc?.release_date ??
    doc?.releaseDate ??
    doc?.first_air_date ??
    doc?.firstAirDate ??
    null;
  if (rawDate == null) return null;
  return typeof rawDate === "string"
    ? rawDate
    : rawDate.toISOString?.().split("T")[0] ?? null;
}

/** Exported for API mappers (new, etc.). */
export function tvEpisodeCountFromDoc(doc) {
  if (doc.type !== "tv") return null;
  const n = doc.number_of_episodes;
  if (typeof n === "number" && n > 0) return n;
  if (String(doc.id ?? "").startsWith("anime_")) {
    const s = doc.season_amount;
    if (typeof s === "number" && s > 0) return s;
  }
  return null;
}

/**
 * Compact row for /api/new, /api/upcoming, /api/updated (shared shape, avoids duplicate mapping).
 */
export function mapCatalogListDoc(doc) {
  const release_date = catalogDocReleaseDateString(doc);
  const isAnimeRow = doc.type === "tv" && String(doc.id ?? "").startsWith("anime_");
  return {
    id: doc.id.toString(),
    title: doc.title ?? doc.name,
    release_date,
    runtimeSeconds: doc.runtimeSeconds ?? null,
    season_amount: doc.season_amount ?? doc.number_of_seasons ?? null,
    number_of_episodes: tvEpisodeCountFromDoc(doc),
    popularity: catalogPopularityScore(
      doc,
      isAnimeRow ? { anime: true } : undefined
    ),
    genre_ids: doc.genre_ids ?? [],
    poster_path: doc.poster_path ?? null,
    backdrop_path: doc.backdrop_path ?? null,
    type: doc.type,
  };
}

export function mapContentDocToItem(doc) {
  const release_date = catalogDocReleaseDateString(doc);
  const isAnimeRow =
    doc.type === "tv" && String(doc.id ?? "").startsWith("anime_");
  return {
    id: doc.id.toString(),
    title: doc.title ?? doc.name,
    name: doc.name ?? doc.title,
    release_date,
    first_air_date: doc.type === "tv" ? doc.first_air_date ?? null : null,
    poster_path: doc.poster_path ?? null,
    backdrop_path: doc.backdrop_path ?? null,
    overview: doc.overview ?? null,
    type: doc.type,
    runtimeSeconds: doc.runtimeSeconds ?? null,
    season_amount:
      doc.type === "tv"
        ? doc.season_amount ?? doc.number_of_seasons ?? 0
        : 0,
    number_of_episodes: tvEpisodeCountFromDoc(doc),
    popularity: catalogPopularityScore(
      doc,
      isAnimeRow ? { anime: true } : undefined
    ),
    vote_average: doc.vote_average ?? null,
  };
}
