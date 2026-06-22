/** TMDB image CDN — full resolution for posters, backdrops, and stills. */
export const TMDB_IMAGE_ORIGINAL = "https://image.tmdb.org/t/p/original";

/**
 * @param {string | null | undefined} path TMDB or absolute image path
 * @returns {string} Full URL, or empty string when missing
 */
export function tmdbImageUrl(path) {
  if (path == null || typeof path !== "string") return "";
  const trimmed = path.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${TMDB_IMAGE_ORIGINAL}${normalized}`;
}

/** @param {string | null | undefined} path @param {string} [fallback] */
export function tmdbImageUrlOr(path, fallback = "") {
  return tmdbImageUrl(path) || fallback;
}
