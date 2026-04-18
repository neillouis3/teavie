/**
 * OMDb detail JSON (`?i=tt…`) — conservative blocks for non-mainstream / adult catalog.
 * OMDb is imperfect; combine with TMDB {@link shouldRejectTmdbMovieFromCatalog}.
 */

/** @param {unknown} omdb */
export function shouldRejectOmdbMovieDetail(omdb) {
  if (!omdb || typeof omdb !== "object") return true;
  const j = /** @type {Record<string, unknown>} */ (omdb);
  if (String(j.Response ?? "").toLowerCase() === "false") return true;
  if (String(j.Type ?? "").toLowerCase() !== "movie") return true;

  const genres = String(j.Genre ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (genres.some((g) => g === "adult" || g === "erotica" || g === "pornographic")) {
    return true;
  }

  const rated = String(j.Rated ?? "").trim().toUpperCase();
  if (rated === "XXX" || rated === "X") return true;

  return false;
}
