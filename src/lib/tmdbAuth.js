/**
 * TMDB read token. Prefer server-only `TMDB_BEARER` in API routes; fall back to
 * `NEXT_PUBLIC_TMDB_BEARER` (client bundles and local dev).
 */
export function tmdbBearerToken() {
  return process.env.TMDB_BEARER || process.env.NEXT_PUBLIC_TMDB_BEARER || "";
}
