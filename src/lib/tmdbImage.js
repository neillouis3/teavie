import { preferHighResAnimeImageUrl } from "./animePoster.js";

/** TMDB image CDN sizes — use poster/backdrop tiers for grids; original for full-bleed when needed. */
export const TMDB_IMAGE_ORIGINAL = "https://image.tmdb.org/t/p/original";
export const TMDB_IMAGE_BACKDROP = "https://image.tmdb.org/t/p/w1280";
export const TMDB_IMAGE_POSTER_GRID = "https://image.tmdb.org/t/p/w342";
export const TMDB_IMAGE_POSTER = "https://image.tmdb.org/t/p/w500";

/**
 * @param {string | null | undefined} path TMDB or absolute image path
 * @param {string} [sizeBase] TMDB size base URL
 * @returns {string} Full URL, or empty string when missing
 */
export function tmdbSizedImageUrl(path, sizeBase = TMDB_IMAGE_ORIGINAL) {
  if (path == null || typeof path !== "string") return "";
  const trimmed = path.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${sizeBase}${normalized}`;
}

/**
 * @param {string | null | undefined} path TMDB or absolute image path
 * @returns {string} Full URL, or empty string when missing
 */
export function tmdbImageUrl(path) {
  return tmdbSizedImageUrl(path, TMDB_IMAGE_ORIGINAL);
}

/** Grid / card posters — w500 keeps LCP reasonable without visible quality loss. */
export function tmdbPosterUrl(path) {
  return tmdbSizedImageUrl(path, TMDB_IMAGE_POSTER);
}

/** Browse / library grids — smaller TMDB tier for faster LCP. */
export function tmdbGridPosterUrl(path) {
  return tmdbSizedImageUrl(path, TMDB_IMAGE_POSTER_GRID);
}

/** Hero / spotlight backdrops. */
export function tmdbBackdropUrl(path) {
  return tmdbSizedImageUrl(path, TMDB_IMAGE_BACKDROP);
}

/** Hero/backdrop URL with anime CDN size upgrades applied. */
export function catalogHeroImageUrl(path) {
  const upgraded = preferHighResAnimeImageUrl(path) ?? path;
  return tmdbImageUrl(upgraded) || (typeof upgraded === "string" ? upgraded : "");
}

/** @param {string | null | undefined} path @param {string} [fallback] */
export function tmdbImageUrlOr(path, fallback = "") {
  return tmdbImageUrl(path) || fallback;
}
