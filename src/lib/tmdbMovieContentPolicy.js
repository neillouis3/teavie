/**
 * TMDB `include_adult=false` is unreliable on list + discover endpoints.
 * We defensively drop titles using detail/list `adult` plus US release certifications
 * that indicate hardcore / legacy X-rated theatrical (when `release_dates` is present).
 */

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
  if (m.adult === true) return true;
  if (usReleaseDatesBlocked(m)) return true;
  return false;
}

/** @param {unknown} show TMDB /tv/{id} or list row */
export function shouldRejectTmdbTvFromCatalog(show) {
  if (!show || typeof show !== "object") return true;
  const s = /** @type {Record<string, unknown>} */ (show);
  return s.adult === true;
}
