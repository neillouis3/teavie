import { jikanGet } from "./jikanFetch.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function episodeNumberFromRow(row, fallbackIndex) {
  const url = typeof row?.url === "string" ? row.url : "";
  const m = /\/episode\/(\d+)\s*$/i.exec(url);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallbackIndex;
}

async function enrichJikanEpisodeDetail(malId, episodeNumber) {
  const res = await jikanGet(`anime/${malId}/episodes/${episodeNumber}`);
  if (!res.ok) return null;
  const json = await res.json();
  const data = json?.data;
  if (!data || typeof data !== "object") return null;
  const synopsis =
    typeof data.synopsis === "string" && data.synopsis.trim()
      ? data.synopsis.trim()
      : null;
  const duration =
    typeof data.duration === "number" && data.duration > 0
      ? Math.max(1, Math.round(data.duration / 60))
      : null;
  return { synopsis, runtime: duration };
}

/**
 * Episode list from Jikan when OMDb / IMDb id is unavailable.
 * @param {number} malId
 * @param {number} [limit]
 */
export async function fetchJikanAnimeEpisodes(malId, limit = 500) {
  const id = Math.floor(Number(malId));
  if (!Number.isFinite(id) || id <= 0) return [];

  const cap = Math.min(500, Math.max(1, Math.floor(Number(limit)) || 500));
  const episodes = [];
  let page = 1;

  while (episodes.length < cap) {
    const res = await jikanGet(`anime/${id}/episodes?page=${page}`);
    if (!res.ok) break;
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    if (!rows.length) break;

    for (let i = 0; i < rows.length && episodes.length < cap; i++) {
      const row = rows[i];
      const epNum = episodeNumberFromRow(row, (page - 1) * 100 + i + 1);
      const title =
        typeof row?.title === "string" && row.title.trim()
          ? row.title.trim()
          : `Episode ${epNum}`;
      episodes.push({
        episode_number: epNum,
        name: title,
        overview: null,
        runtime: null,
        still_path: null,
      });
    }

    if (!json?.pagination?.has_next_page) break;
    page += 1;
    if (page > 20) break;
    await sleep(350);
  }

  episodes.sort((a, b) => a.episode_number - b.episode_number);

  const enrichCap = Math.min(episodes.length, 30);
  for (let i = 0; i < enrichCap; i++) {
    const ep = episodes[i];
    const detail = await enrichJikanEpisodeDetail(id, ep.episode_number);
    if (detail?.synopsis) ep.overview = detail.synopsis;
    if (detail?.runtime != null) ep.runtime = detail.runtime;
    if (i < enrichCap - 1) await sleep(350);
  }

  return episodes;
}
