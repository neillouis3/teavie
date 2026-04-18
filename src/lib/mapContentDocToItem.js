/**
 * Map a `content` collection document to a ContentItem-style payload for rails/cards.
 */
import { catalogPopularityScore } from "@/lib/catalogPopularity";

export function mapContentDocToItem(doc) {
  const rawDate =
    doc.release_date ??
    doc.releaseDate ??
    doc.first_air_date ??
    doc.firstAirDate ??
    null;
  const release_date =
    rawDate == null
      ? null
      : typeof rawDate === "string"
        ? rawDate
        : rawDate.toISOString?.().split("T")[0] ?? null;
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
    popularity: catalogPopularityScore(
      doc,
      isAnimeRow ? { anime: true } : undefined
    ),
    vote_average: doc.vote_average ?? null,
  };
}
