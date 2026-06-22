/**
 * Map a `content` collection document to a ContentItem-style payload for rails/cards.
 */
import { catalogPopularityScore } from "@/lib/catalogPopularity";
import { genreNamesFromDoc } from "@/lib/imdbGenres";

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
export function runtimeSecondsFromDoc(doc) {
  if (!doc || typeof doc !== "object") return null;
  const rs = doc.runtimeSeconds;
  if (typeof rs === "number" && Number.isFinite(rs) && rs > 0) return rs;
  const rt = doc.runtime;
  if (typeof rt === "number" && Number.isFinite(rt) && rt > 0) {
    return Math.round(rt * 60);
  }
  if (typeof rt === "string") {
    const m = /^(\d+)\s*min/i.exec(rt.trim());
    if (m) {
      const mins = Number(m[1]);
      if (Number.isFinite(mins) && mins > 0) return mins * 60;
    }
  }
  return null;
}

export function tvSeasonCountFromDoc(doc) {
  if (!doc || doc.type !== "tv") return null;
  for (const c of [doc.season_amount, doc.number_of_seasons]) {
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
  }
  return null;
}

/** Exported for API mappers (new, etc.). */
export function tvEpisodeCountFromDoc(doc) {
  if (!doc || doc.type !== "tv") return null;
  const n = doc.number_of_episodes;
  if (typeof n === "number" && Number.isFinite(n) && n > 0) return n;
  if (String(doc.id ?? "").startsWith("anime_")) {
    const ani = doc.anilist?.episodes;
    if (typeof ani === "number" && ani > 0) return ani;
    const s = doc.season_amount;
    if (typeof s === "number" && s > 0) return s;
  }
  return null;
}

export function usCertificationFromDoc(doc) {
  if (!doc || typeof doc !== "object") return null;

  const movieResults = doc.release_dates?.results;
  if (Array.isArray(movieResults)) {
    const us = movieResults.find((r) => r?.iso_3166_1 === "US");
    const rels = us?.release_dates;
    if (Array.isArray(rels)) {
      const theatrical = rels.find(
        (rd) => rd?.type === 3 && String(rd?.certification ?? "").trim()
      );
      if (theatrical?.certification) return String(theatrical.certification).trim();
      const any = rels.find((rd) => String(rd?.certification ?? "").trim());
      if (any?.certification) return String(any.certification).trim();
    }
  }

  const tvResults = doc.content_ratings?.results;
  if (Array.isArray(tvResults)) {
    const us = tvResults.find((r) => r?.iso_3166_1 === "US");
    const rating = us?.rating;
    if (rating && String(rating).trim()) return String(rating).trim();
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
    runtimeSeconds: runtimeSecondsFromDoc(doc),
    season_amount: tvSeasonCountFromDoc(doc),
    number_of_episodes: tvEpisodeCountFromDoc(doc),
    popularity: catalogPopularityScore(
      doc,
      isAnimeRow ? { anime: true } : undefined
    ),
    genre_ids: [],
    poster_path: doc.poster_path ?? null,
    backdrop_path: doc.backdrop_path ?? null,
    type: doc.type,
    genres: genreNamesFromDoc(doc),
    imdb_genres: Array.isArray(doc.imdb_genres)
      ? doc.imdb_genres.map((g) => String(g).trim()).filter(Boolean)
      : genreNamesFromDoc(doc),
    certification: usCertificationFromDoc(doc),
    vote_average: doc.vote_average ?? null,
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
    runtimeSeconds: runtimeSecondsFromDoc(doc),
    season_amount: doc.type === "tv" ? tvSeasonCountFromDoc(doc) ?? 0 : 0,
    number_of_episodes: tvEpisodeCountFromDoc(doc),
    popularity: catalogPopularityScore(
      doc,
      isAnimeRow ? { anime: true } : undefined
    ),
    vote_average: doc.vote_average ?? null,
    genres: genreNamesFromDoc(doc),
    imdb_genres: Array.isArray(doc.imdb_genres)
      ? doc.imdb_genres.map((g) => String(g).trim()).filter(Boolean)
      : genreNamesFromDoc(doc),
    certification: usCertificationFromDoc(doc),
  };
}
