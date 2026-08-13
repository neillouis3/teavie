/**
 * TMDB `include_adult=false` is unreliable on list + discover endpoints.
 * We defensively drop titles using detail/list `adult` plus US release certifications
 * that indicate hardcore / legacy X-rated theatrical (when `release_dates` is present).
 */

import { isBlockedAdultTmdbTvShow } from "./animeContentPolicy.js";

/** Production companies excluded from the movie catalog (exact name match, case-insensitive). */
export const BLOCKED_MOVIE_PRODUCTION_COMPANIES = [
  "Vivamax",
  "DMV Entertainment",
  "Lumino",
];

/** TMDB movie ids manually blocked from catalog and direct watch URLs. */
export const BLOCKED_MOVIE_TMDB_IDS = [
  1522126,
];

/** @param {unknown} id */
export function isBlockedMovieTmdbId(id) {
  const n =
    typeof id === "number"
      ? id
      : typeof id === "string"
        ? Number(id.trim())
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return false;
  return BLOCKED_MOVIE_TMDB_IDS.includes(n);
}

function normalizeCompanyName(name) {
  return String(name ?? "").trim().toLowerCase();
}

/** @param {unknown} movie */
export function movieProductionCompanyNames(movie) {
  const list = movie?.production_companies;
  if (!Array.isArray(list)) return [];
  return list
    .map((c) => String(c?.name ?? "").trim())
    .filter(Boolean);
}

/** @param {unknown} movie */
export function movieHasBlockedProductionCompany(movie) {
  const blocked = new Set(
    BLOCKED_MOVIE_PRODUCTION_COMPANIES.map(normalizeCompanyName)
  );
  return movieProductionCompanyNames(movie).some((name) =>
    blocked.has(normalizeCompanyName(name))
  );
}

/** @param {unknown} row */
export function tmdbListMovieLooksAdult(row) {
  if (!row || typeof row !== "object") return true;
  const r = /** @type {Record<string, unknown>} */ (row);
  return r.adult === true;
}

function usReleaseDatesBlocked(movie) {
  const results = movie?.release_dates?.results;
  if (!Array.isArray(results)) return false;
  for (const country of results) {
    if (country?.iso_3166_1 !== "US") continue;
    const rels = country.release_dates;
    if (!Array.isArray(rels)) continue;
    for (const rd of rels) {
      const c = String(rd?.certification ?? "")
        .trim()
        .toUpperCase();
      if (c === "X" || c === "XXX") return true;
    }
  }
  return false;
}

/**
 * @param {unknown} movie TMDB /movie/{id} JSON (optionally with `release_dates` from append_to_response)
 * @returns {true} if the title must not be stored or shown from catalog
 */
export function shouldRejectTmdbMovieFromCatalog(movie) {
  if (!movie || typeof movie !== "object") return true;
  const m = /** @type {Record<string, unknown>} */ (movie);
  if (isBlockedMovieTmdbId(m.id ?? m.tmdb_id)) return true;
  if (m.adult === true) return true;
  if (usReleaseDatesBlocked(m)) return true;
  if (movieHasBlockedProductionCompany(m)) return true;
  return false;
}

/** @param {unknown} show TMDB /tv/{id} or list row */
export function shouldRejectTmdbTvFromCatalog(show) {
  if (!show || typeof show !== "object") return true;
  return isBlockedAdultTmdbTvShow(show);
}
