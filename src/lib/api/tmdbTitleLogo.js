/**
 * Pick a TMDB title logo path (official wordmark) for hero overlays.
 * Prefer English, then null-language, then highest-voted.
 */

import { tmdbAuth, tmdbFetchJson } from "@/lib/tmdbAuth";

/**
 * @param {unknown} logos
 * @returns {string | null} file_path like `/abc.png`
 */
export function pickTmdbTitleLogoPath(logos) {
  if (!Array.isArray(logos) || logos.length === 0) return null;

  const rows = logos
    .filter(
      (row) =>
        row &&
        typeof row === "object" &&
        typeof row.file_path === "string" &&
        row.file_path.trim().startsWith("/")
    )
    .map((row) => ({
      file_path: String(row.file_path).trim(),
      iso_639_1:
        typeof row.iso_639_1 === "string" ? row.iso_639_1.trim().toLowerCase() : null,
      vote_average: Number(row.vote_average) || 0,
      vote_count: Number(row.vote_count) || 0,
    }));

  if (rows.length === 0) return null;

  const score = (row) => {
    let langBonus = 0;
    if (row.iso_639_1 === "en") langBonus = 1000;
    else if (row.iso_639_1 == null || row.iso_639_1 === "") langBonus = 500;
    return langBonus + row.vote_average * 10 + row.vote_count;
  };

  rows.sort((a, b) => score(b) - score(a));
  return rows[0].file_path;
}

/**
 * @param {"movie" | "tv"} mediaType
 * @param {string | number} tmdbId
 * @returns {Promise<string | null>}
 */
export async function fetchTmdbTitleLogoPath(mediaType, tmdbId) {
  const auth = tmdbAuth();
  const id = String(tmdbId ?? "").trim();
  if (!auth || !id || !/^\d+$/.test(id)) return null;
  const kind = mediaType === "tv" ? "tv" : "movie";

  try {
    const data = await tmdbFetchJson(
      `https://api.themoviedb.org/3/${kind}/${id}/images?include_image_language=en,null`,
      auth,
      { timeoutMs: 8000 }
    );
    return pickTmdbTitleLogoPath(data?.logos);
  } catch {
    return null;
  }
}
