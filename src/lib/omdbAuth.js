/**
 * OMDb reads `OMDB_API_KEY` from the environment (set in `.env` / `.env.local`).
 * Every OMDb request must include `apikey` — use {@link omdbUrlWithKey}.
 */

export function omdbApiKey() {
  return String(process.env.OMDB_API_KEY ?? "").trim();
}

/**
 * @param {Record<string, string>} params query params without `apikey`
 * @returns {string} query string including `apikey` when configured
 */
export function omdbQueryWithKey(params) {
  const key = omdbApiKey();
  const q = new URLSearchParams(params);
  if (key) q.set("apikey", key);
  return q.toString();
}
