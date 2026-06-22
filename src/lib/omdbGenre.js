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
    type: type === "movie" ? "movie" : "series",
    r: "json",
  });
  if (!qs.includes("apikey=")) return null;

  const res = await fetch(`${OMDB_BASE}?${qs}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (data?.Response !== "True") return null;

  const genre = data.Genre;
  if (typeof genre !== "string" || !genre.trim() || genre === "N/A") return null;
  return genre.trim();
}
