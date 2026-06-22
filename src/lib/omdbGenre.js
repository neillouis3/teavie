import { omdbQueryWithKey } from "./omdbAuth.js";

const OMDB_BASE = "https://www.omdbapi.com/";

/**
 * Fetch the OMDb `Genre` string for a title (IMDb-style comma-separated labels).
 * @param {string} imdbId e.g. tt4574334
 * @param {"movie" | "tv"} type
 * @returns {Promise<string | null>}
 */
export async function fetchOmdbGenreRaw(imdbId, type) {
  const id = String(imdbId ?? "").trim();
  if (!/^tt\d+$/i.test(id)) return null;

  const qs = omdbQueryWithKey({
    i: id,
    ...(type === "movie" ? { type: "movie" } : type === "tv" ? { type: "series" } : {}),
    r: "json",
  });
  if (!qs.includes("apikey=")) return null;

  for (const query of [qs, omdbQueryWithKey({ i: id, r: "json" })]) {
    const res = await fetch(`${OMDB_BASE}?${query}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) continue;

    const data = await res.json();
    if (data?.Response !== "True") {
      const err = String(data?.Error ?? "");
      if (/limit reached/i.test(err)) {
        const e = new Error(`OMDb rate limit: ${err}`);
        e.code = "OMDB_RATE_LIMIT";
        throw e;
      }
      continue;
    }

    const genre = data.Genre;
    if (typeof genre === "string" && genre.trim() && genre !== "N/A") {
      return genre.trim();
    }
  }
  return null;
}
