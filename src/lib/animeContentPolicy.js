/**
 * Block hentai / adult anime from browse, search, and show pages.
 *
 * AniList `isAdult` and Hentai genre tags are noisy on all-ages MAL rows (G/PG),
 * so those ratings exempt a title from adult blocking.
 */

import { tmdbFetchJson } from "./tmdbAuth.js";

/** @param {Record<string, unknown> | null | undefined} doc */
export function malAllAgesAnimeRating(doc) {
  const rating = String(doc?.rating ?? "").trim();
  if (/^(G|PG)(\s|-)/i.test(rating)) return true;

  const tags = doc?.tags;
  if (!Array.isArray(tags)) return false;
  return tags.some((tag) => {
    const t = String(tag).trim();
    return /^g\s*-\s*all ages$/i.test(t) || /^pg\s*-\s*children$/i.test(t);
  });
}

/** @param {Record<string, unknown> | null | undefined} doc */
export function docHasMalHentaiGenre(doc) {
  const genres = doc?.mal_genre_names;
  if (!Array.isArray(genres)) return false;
  return genres.some((g) => /^hentai$/i.test(String(g ?? "")));
}

/** @param {Record<string, unknown> | null | undefined} doc */
export function docHasAnilistHentaiGenre(doc) {
  const genres = doc?.anilist?.genres;
  if (!Array.isArray(genres)) return false;
  return genres.some((g) => /^hentai$/i.test(String(g ?? "")));
}

/** @param {Record<string, unknown> | null | undefined} doc */
export function docHasRxHentaiRating(doc) {
  const rating = String(doc?.rating ?? "");
  if (/Rx/i.test(rating)) return true;

  const tags = doc?.tags;
  if (!Array.isArray(tags)) return false;
  return tags.some((tag) => /rx/i.test(String(tag)));
}

/** @param {Record<string, unknown> | null | undefined} doc */
export function docHasStoredHentaiGenre(doc) {
  const imdb = doc?.imdb_genres;
  if (Array.isArray(imdb) && imdb.some((g) => /^hentai$/i.test(String(g ?? "")))) {
    return true;
  }
  const omdb = doc?.omdb?.genre;
  if (typeof omdb === "string" && /(^|,\s*)Hentai(\s*,|$)/i.test(omdb.trim())) {
    return true;
  }
  return docHasMalHentaiGenre(doc) || docHasAnilistHentaiGenre(doc);
}

/** Known TMDB TV ids that must not resolve (backup when keywords are missing). */
export const BLOCKED_TV_TMDB_IDS = [
  207840, // Harem Camp! (hentai ONA)
];

/** @param {unknown} raw */
export function normalizeTmdbId(raw) {
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number(raw.trim())
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

/** All TMDB TV ids referenced on a catalog doc (id, tmdb_id, external_ids). */
export function catalogDocTmdbIds(doc) {
  if (!doc || typeof doc !== "object") return [];
  const out = new Set();
  for (const raw of [
    doc.id,
    doc.tmdb_id,
    doc.external_ids?.tmdb_id,
  ]) {
    const n = normalizeTmdbId(raw);
    if (n != null) out.add(n);
  }
  return [...out];
}

/** Primary TMDB TV id for a catalog doc, if any. */
export function catalogDocTmdbId(doc) {
  const ids = catalogDocTmdbIds(doc);
  return ids[0] ?? null;
}

/** @param {unknown} id */
export function isBlockedTvTmdbId(id) {
  const n = normalizeTmdbId(id);
  if (n == null) return false;
  return BLOCKED_TV_TMDB_IDS.includes(n);
}

/** @param {Record<string, unknown> | null | undefined} doc */
export function docReferencesBlockedTvTmdbId(doc) {
  return catalogDocTmdbIds(doc).some((id) => isBlockedTvTmdbId(id));
}

/**
 * Whether a catalog anime row should be hidden (browse/search/show).
 * @param {Record<string, unknown> | null | undefined} doc
 */
export function isBlockedAdultAnimeDoc(doc) {
  if (!doc || typeof doc !== "object") return false;
  if (docReferencesBlockedTvTmdbId(doc)) return true;
  if (doc.adult === true) return true;
  if (docHasMalHentaiGenre(doc)) return true;
  if (docHasRxHentaiRating(doc)) return true;

  const allAges = malAllAgesAnimeRating(doc);
  if (docHasAnilistHentaiGenre(doc) && !allAges) return true;

  const imdb = doc.imdb_genres;
  if (
    Array.isArray(imdb) &&
    imdb.some((g) => /^hentai$/i.test(String(g ?? ""))) &&
    !allAges
  ) {
    return true;
  }

  const omdb = doc.omdb?.genre;
  if (
    typeof omdb === "string" &&
    /(^|,\s*)Hentai(\s*,|$)/i.test(omdb.trim()) &&
    !allAges
  ) {
    return true;
  }

  if (doc.anilist?.isAdult === true && !allAges) return true;
  return false;
}

/** MAL + AniList payloads during import (before full doc is built). */
export function shouldSkipAdultAnimeImport(anime, anilist) {
  const malGenres = Array.isArray(anime?.genres) ? anime.genres : [];
  if (malGenres.some((g) => /^hentai$/i.test(String(g?.name ?? "")))) return true;

  const rating = String(anime?.rating ?? "");
  if (/Rx/i.test(rating)) return true;

  const aniGenres = Array.isArray(anilist?.genres) ? anilist.genres : [];
  const hasAniHentai = aniGenres.some((g) => /^hentai$/i.test(String(g ?? "")));
  const allAges = /^(G|PG)(\s|-)/i.test(rating.trim());

  if (hasAniHentai && !allAges) return true;
  if (anilist?.isAdult === true && !allAges) return true;
  return false;
}

const MAL_ALL_AGES_MONGO = {
  $or: [
    { rating: { $regex: /^(G|PG)(\s|-)/i } },
    { tags: { $regex: /^(g\s*-\s*all ages|pg\s*-\s*children)$/i } },
  ],
};

const BLOCKED_TV_TMDB_ID_VALUES = [
  ...BLOCKED_TV_TMDB_IDS,
  ...BLOCKED_TV_TMDB_IDS.map(String),
];

/** Raw Mongo filter matching blocked adult anime rows. */
export function catalogBlockedAdultAnimeMongoFilter() {
  return {
    $or: [
      { adult: true },
      { id: { $in: BLOCKED_TV_TMDB_ID_VALUES } },
      { tmdb_id: { $in: BLOCKED_TV_TMDB_IDS } },
      { "external_ids.tmdb_id": { $in: BLOCKED_TV_TMDB_IDS } },
      { mal_genre_names: { $regex: /^Hentai$/i } },
      { imdb_genres: { $regex: /^Hentai$/i } },
      { "omdb.genre": { $regex: /(^|,\s*)Hentai(\s*,|$)/i } },
      { rating: { $regex: /Rx/i } },
      { tags: { $regex: /rx/i } },
      {
        $and: [
          { "anilist.genres": { $regex: /^Hentai$/i } },
          { $nor: [MAL_ALL_AGES_MONGO] },
        ],
      },
      {
        $and: [{ "anilist.isAdult": true }, { $nor: [MAL_ALL_AGES_MONGO] }],
      },
    ],
  };
}

/**
 * Mongo clause: exclude blocked adult anime from catalog queries.
 * @returns {Record<string, unknown>}
 */
export function catalogExcludeAdultAnimeMongoClause() {
  return { $nor: [catalogBlockedAdultAnimeMongoFilter()] };
}

/** Hide catalog TV rows tied to blocked TMDB ids (numeric `/shows/{id}` leaks). */
export function catalogBlockedTmdbTvMongoFilter() {
  return {
    $or: [
      { adult: true },
      { id: { $in: BLOCKED_TV_TMDB_ID_VALUES } },
      { tmdb_id: { $in: BLOCKED_TV_TMDB_IDS } },
      { "external_ids.tmdb_id": { $in: BLOCKED_TV_TMDB_IDS } },
    ],
  };
}

export function catalogExcludeBlockedTmdbTvMongoClause() {
  return { $nor: [catalogBlockedTmdbTvMongoFilter()] };
}

/** Alias for purge scripts. */
export const catalogExcludeAdultAnimeMongoFilter = catalogBlockedAdultAnimeMongoFilter;

/** TMDB TV keywords that indicate hentai / pornographic animation. */
const BLOCKED_TMDB_TV_KEYWORD = /^(hentai|softcore|pornographic|erotica)$/i;

/** @param {unknown} show TMDB /tv/{id} JSON or probe object */
export function tmdbTvKeywordNames(show) {
  const raw = show?.keywords?.results ?? show?.keywords ?? [];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => String(entry?.name ?? entry ?? "").trim())
    .filter(Boolean);
}

/**
 * Block direct TMDB TV rows (numeric `/shows/{tmdbId}` URLs).
 * @param {Record<string, unknown> | null | undefined} show
 */
export function isBlockedAdultTmdbTvShow(show) {
  if (!show || typeof show !== "object") return false;
  if (docReferencesBlockedTvTmdbId(show)) return true;
  if (show.adult === true) return true;
  if (isBlockedAdultAnimeDoc(show)) return true;
  return tmdbTvKeywordNames(show).some((name) => BLOCKED_TMDB_TV_KEYWORD.test(name));
}

/**
 * Fetch TMDB TV metadata + keywords for adult-content checks.
 * @param {number} tmdbId
 */
export async function fetchTmdbTvPolicyProbe(tmdbId) {
  const id = normalizeTmdbId(tmdbId);
  if (id == null) return null;
  try {
    const show = await tmdbFetchJson(
      `https://api.themoviedb.org/3/tv/${id}?language=en-US&append_to_response=keywords`
    );
    if (!show || typeof show !== "object") return null;
    return {
      type: "tv",
      id,
      tmdb_id: id,
      adult: show.adult === true,
      origin_country: show.origin_country,
      original_language: show.original_language,
      first_air_date: show.first_air_date ?? null,
      genre_ids: Array.isArray(show.genres)
        ? show.genres.map((g) => g?.id).filter((n) => typeof n === "number")
        : [],
      genres: show.genres,
      keywords: show.keywords,
      name: show.name,
      title: show.name,
    };
  } catch {
    return null;
  }
}

/**
 * @param {number} tmdbId
 * @param {{ adminBypass?: boolean; collection?: import('mongodb').Collection | null }} [opts]
 */
export async function assertTvTmdbIdAllowed(tmdbId, opts = {}) {
  if (opts.adminBypass) return { allowed: true, probe: null };
  const id = normalizeTmdbId(tmdbId);
  if (id == null) return { allowed: true, probe: null };
  if (isBlockedTvTmdbId(id)) {
    return {
      allowed: false,
      probe: { type: "tv", id, tmdb_id: id },
    };
  }
  const probe = await fetchTmdbTvPolicyProbe(id);
  if (probe && isBlockedAdultTmdbTvShow(probe)) {
    return { allowed: false, probe };
  }
  const { isBlockedAdultTmdbTvShowEnriched } = await import("./animeTmdbPolicyEnrich.js");
  if (
    probe &&
    (await isBlockedAdultTmdbTvShowEnriched(id, probe, { collection: opts.collection }))
  ) {
    return { allowed: false, probe };
  }
  return { allowed: true, probe };
}
