import { tmdbAuth, tmdbFetchJson } from "./tmdbAuth.js";

function todayYmdUtc() {
  return new Date().toISOString().slice(0, 10);
}

function episodeAired(airDate, todayYmd) {
  const ad = String(airDate ?? "").trim();
  if (ad.length < 10) return true;
  return ad <= todayYmd;
}

/**
 * TMDB season episode rows (still_path, overview, runtime, air_date).
 * @param {number | string} tvId
 * @param {number} seasonNum
 * @param {{ airedOnly?: boolean }} [opts]
 */
export async function fetchTmdbSeasonEpisodes(tvId, seasonNum, opts = {}) {
  const id = String(tvId ?? "").trim();
  const season = Math.floor(Number(seasonNum));
  if (!/^\d+$/.test(id) || !Number.isFinite(season) || season < 0) {
    return [];
  }

  const auth = tmdbAuth();
  if (!auth) return [];

  let json;
  try {
    json = await tmdbFetchJson(
      `https://api.themoviedb.org/3/tv/${id}/season/${season}?language=en-US`,
      auth,
      { timeoutMs: 15000 }
    );
  } catch {
    return [];
  }
  const today = todayYmdUtc();
  const airedOnly = opts.airedOnly !== false;

  return (json.episodes ?? [])
    .map((ep) => ({
      episode_number: Number(ep.episode_number),
      name:
        typeof ep.name === "string" && ep.name.trim()
          ? ep.name.trim()
          : `Episode ${ep.episode_number}`,
      runtime:
        typeof ep.runtime === "number" && ep.runtime > 0 ? ep.runtime : null,
      air_date: ep.air_date ?? null,
      still_path:
        typeof ep.still_path === "string" && ep.still_path.trim()
          ? ep.still_path.trim()
          : null,
      overview:
        typeof ep.overview === "string" && ep.overview.trim()
          ? ep.overview.trim()
          : null,
    }))
    .filter((ep) => {
      if (!Number.isFinite(ep.episode_number) || ep.episode_number <= 0) {
        return false;
      }
      if (!airedOnly) return true;
      return episodeAired(ep.air_date, today);
    })
    .sort((a, b) => a.episode_number - b.episode_number);
}

/**
 * @param {Awaited<ReturnType<typeof fetchTmdbSeasonEpisodes>>} rows
 * @returns {Map<number, string>}
 */
export function tmdbStillPathByEpisode(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row.still_path) map.set(row.episode_number, row.still_path);
  }
  return map;
}
