import { omdbQueryWithKey } from "./omdbAuth.js";

const OMDB_BASE = "https://www.omdbapi.com/";

/**
 * OMDb season episode list: `?i=tt…&Season=1`
 * @param {string} imdbId
 * @param {number} [season]
 * @returns {Promise<Array<{ episode_number: number; name: string; overview: string | null; runtime: number | null; still_path: null; released: string | null }>>}
 */
export async function fetchOmdbSeasonEpisodes(imdbId, season = 1) {
  const id = String(imdbId ?? "").trim();
  if (!/^tt\d+$/i.test(id)) return [];

  const seasonNum = Math.max(1, Math.floor(Number(season)) || 1);
  const qs = omdbQueryWithKey({ i: id, Season: String(seasonNum), r: "json" });
  if (!qs.includes("apikey=")) return [];

  const res = await fetch(`${OMDB_BASE}?${qs}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];

  const data = await res.json();
  if (data?.Response !== "True") {
    const err = String(data?.Error ?? "");
    if (/limit reached/i.test(err)) {
      const e = new Error(`OMDb rate limit: ${err}`);
      e.code = "OMDB_RATE_LIMIT";
      throw e;
    }
    return [];
  }

  const rows = Array.isArray(data?.Episodes) ? data.Episodes : [];
  return rows
    .map((row) => {
      const epNum = parseInt(String(row?.Episode ?? ""), 10);
      if (!Number.isFinite(epNum) || epNum <= 0) return null;
      const title =
        typeof row?.Title === "string" && row.Title.trim() && row.Title !== "N/A"
          ? row.Title.trim()
          : `Episode ${epNum}`;
      const released =
        typeof row?.Released === "string" && row.Released.trim() && row.Released !== "N/A"
          ? row.Released.trim()
          : null;
      return {
        episode_number: epNum,
        name: title,
        overview: null,
        runtime: null,
        still_path: null,
        released,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.episode_number - b.episode_number);
}

export function pickImdbIdFromDoc(doc) {
  if (!doc || typeof doc !== "object") return null;
  const candidates = [doc.imdb_id, doc.external_ids?.imdb_id];
  for (const raw of candidates) {
    const id = String(raw ?? "").trim();
    if (/^tt\d+$/i.test(id)) return id;
  }
  return null;
}
