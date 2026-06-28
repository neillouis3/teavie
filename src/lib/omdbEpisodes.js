import { omdbQueryWithKey } from "./omdbAuth.js";

const OMDB_BASE = "https://www.omdbapi.com/";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseOmdbRuntimeMinutes(raw) {
  const s = String(raw ?? "").trim();
  if (!s || s === "N/A") return null;
  const m = /(\d+)\s*min/i.exec(s);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function omdbJson(params) {
  const qs = omdbQueryWithKey({ ...params, r: "json" });
  if (!qs.includes("apikey=")) return null;

  const res = await fetch(`${OMDB_BASE}?${qs}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (data?.Response !== "True") {
    const err = String(data?.Error ?? "");
    if (/limit reached/i.test(err)) {
      const e = new Error(`OMDb rate limit: ${err}`);
      e.code = "OMDB_RATE_LIMIT";
      throw e;
    }
    return null;
  }
  return data;
}

/**
 * OMDb season episode list: `?i=tt…&Season=1`
 * @param {string} imdbId
 * @param {number} [season]
 * @returns {Promise<Array<{ episode_number: number; name: string; overview: string | null; runtime: number | null; still_path: null; released: string | null; imdb_episode_id: string | null }>>}
 */
export async function fetchOmdbSeasonEpisodes(imdbId, season = 1) {
  const id = String(imdbId ?? "").trim();
  if (!/^tt\d+$/i.test(id)) return [];

  const seasonNum = Math.max(1, Math.floor(Number(season)) || 1);
  const data = await omdbJson({ i: id, Season: String(seasonNum) });
  if (!data) return [];

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
      const imdbEpisodeId =
        typeof row?.imdbID === "string" && /^tt\d+$/i.test(row.imdbID.trim())
          ? row.imdbID.trim()
          : null;
      return {
        episode_number: epNum,
        name: title,
        overview: null,
        runtime: null,
        still_path: null,
        released,
        imdb_episode_id: imdbEpisodeId,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.episode_number - b.episode_number);
}

/**
 * @param {string} imdbEpisodeId
 * @param {number} [maxRetries]
 */
async function fetchOmdbEpisodeDetail(imdbEpisodeId, maxRetries = 4) {
  const id = String(imdbEpisodeId ?? "").trim();
  if (!/^tt\d+$/i.test(id)) return null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await omdbJson({ i: id });
      if (!data) {
        if (attempt < maxRetries) {
          await sleep(300 * 2 ** attempt);
          continue;
        }
        return null;
      }
      const plot =
        typeof data.Plot === "string" && data.Plot.trim() && data.Plot !== "N/A"
          ? data.Plot.trim()
          : null;
      const runtime = parseOmdbRuntimeMinutes(data.Runtime);
      return { overview: plot, runtime };
    } catch (err) {
      if (err?.code === "OMDB_RATE_LIMIT" && attempt < maxRetries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw err;
    }
  }
  return null;
}

/**
 * Enrich episode rows with IMDb plot + runtime via per-episode OMDb lookups.
 * @param {Array<{ overview?: string | null; runtime?: number | null; imdb_episode_id?: string | null }>} episodes
 * @param {{ concurrency?: number }} [opts]
 */
async function enrichOmdbEpisodePlots(episodes, { concurrency = 24 } = {}) {
  const queue = episodes.filter((ep) => ep.imdb_episode_id && !ep.overview);
  if (!queue.length) return;

  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (true) {
      const i = idx++;
      if (i >= queue.length) return;
      const ep = queue[i];
      try {
        const detail = await fetchOmdbEpisodeDetail(ep.imdb_episode_id);
        if (detail?.overview) ep.overview = detail.overview;
        if (detail?.runtime != null) ep.runtime = detail.runtime;
      } catch {
        /* skip failed enrichment */
      }
    }
  });
  await Promise.all(workers);
}

function pushFlattenedEpisode(episodes, row) {
  episodes.push({
    episode_number: episodes.length + 1,
    name: row.name,
    overview: row.overview,
    runtime: row.runtime,
    still_path: null,
    imdb_episode_id: row.imdb_episode_id,
  });
}

/**
 * Pick the right IMDb season(s) for a catalog row.
 * Single-cour entries (e.g. JJK S2, 23 eps) must not be sliced from season 1 of a multi-season show.
 * @param {string} imdbId
 * @param {{ limit?: number; enrichPlots?: boolean; imdbSeason?: number | null }} [opts]
 */
export async function fetchOmdbAnimeEpisodesForCatalog(
  imdbId,
  { limit = 500, enrichPlots = true, imdbSeason = null } = {}
) {
  const id = String(imdbId ?? "").trim();
  if (!/^tt\d+$/i.test(id)) return [];

  const cap = Math.min(500, Math.max(1, Math.floor(Number(limit)) || 500));
  const seasonHint = Math.floor(Number(imdbSeason));

  if (Number.isFinite(seasonHint) && seasonHint >= 1) {
    const rows = await fetchOmdbSeasonEpisodes(id, seasonHint);
    const episodes = rows.slice(0, cap).map((row) => ({
      episode_number: row.episode_number,
      name: row.name,
      overview: row.overview,
      runtime: row.runtime,
      still_path: null,
      imdb_episode_id: row.imdb_episode_id,
    }));
    if (enrichPlots && episodes.length > 0) {
      await enrichOmdbEpisodePlots(episodes);
    }
    return episodes.map(({ imdb_episode_id: _imdb, ...ep }) => ep);
  }

  const series = await omdbJson({ i: id });
  const totalSeasons = Math.max(
    1,
    Math.min(30, parseInt(String(series?.totalSeasons ?? "1"), 10) || 1)
  );

  const seasons = [];
  for (let season = 1; season <= totalSeasons; season++) {
    const rows = await fetchOmdbSeasonEpisodes(id, season);
    if (rows.length) seasons.push({ season, rows });
  }
  if (!seasons.length) return [];

  const totalEps = seasons.reduce((n, s) => n + s.rows.length, 0);
  const episodes = [];

  const useFullSeries = cap >= totalEps || seasons.length === 1;
  if (useFullSeries) {
    for (const { rows } of seasons) {
      for (const row of rows) {
        pushFlattenedEpisode(episodes, row);
        if (episodes.length >= cap) break;
      }
      if (episodes.length >= cap) break;
    }
  } else {
    const exactMatches = seasons.filter((s) => s.rows.length === cap);
    const pick =
      exactMatches.length > 0
        ? exactMatches[exactMatches.length - 1]
        : seasons.reduce((best, s) => {
            if (!best) return s;
            const dbest = Math.abs(best.rows.length - cap);
            const dcur = Math.abs(s.rows.length - cap);
            return dcur < dbest ? s : best;
          }, null);

    const target = pick ?? seasons[seasons.length - 1];
    for (const row of target.rows) {
      episodes.push({
        episode_number: row.episode_number,
        name: row.name,
        overview: row.overview,
        runtime: row.runtime,
        still_path: null,
        imdb_episode_id: row.imdb_episode_id,
      });
      if (episodes.length >= cap) break;
    }
  }

  if (enrichPlots && episodes.length > 0) {
    await enrichOmdbEpisodePlots(episodes);
  }

  return episodes.map(({ imdb_episode_id: _imdb, ...ep }) => ep);
}

/**
 * Flatten all IMDb/OMDb seasons into absolute episode numbers (S1E1 → 1, S2E1 → n+1, …).
 * @param {string} imdbId
 * @param {{ limit?: number; enrichPlots?: boolean }} [opts]
 */
export async function fetchOmdbAllAnimeEpisodes(
  imdbId,
  { limit = 500, enrichPlots = true } = {}
) {
  return fetchOmdbAnimeEpisodesForCatalog(imdbId, { limit, enrichPlots });
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
