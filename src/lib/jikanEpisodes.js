import { jikanGet } from "./jikanFetch.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function pickNumeric(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Jikan list rows use `mal_id` as the episode index; URL is a fallback. */
function episodeNumberFromRow(row, fallbackIndex) {
  const fromMal = pickNumeric(row?.mal_id);
  if (fromMal != null) return fromMal;

  const url = typeof row?.url === "string" ? row.url : "";
  const m = /\/episode\/(\d+)\s*$/i.exec(url);
  if (m) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallbackIndex;
}

function mapJikanEpisodeListRow(row, fallbackIndex) {
  const epNum = episodeNumberFromRow(row, fallbackIndex);
  const title =
    typeof row?.title === "string" && row.title.trim()
      ? row.title.trim()
      : `Episode ${epNum}`;
  const air_date =
    typeof row?.aired === "string" && row.aired.trim() ? row.aired.trim() : null;

  return {
    episode_number: epNum,
    name: title,
    air_date,
    overview: null,
    runtime: null,
    still_path: null,
    filler: row?.filler === true,
    recap: row?.recap === true,
  };
}

/**
 * Per-episode detail from Jikan (`/anime/{id}/episodes/{episode}`).
 * Synopsis and runtime live here — not on the paginated list endpoint.
 * @see https://docs.jikan.moe/usage/anime/episodes/
 */
export async function fetchJikanAnimeEpisodeDetail(malId, episodeNumber) {
  const id = Math.floor(Number(malId));
  const ep = Math.floor(Number(episodeNumber));
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(ep) || ep <= 0) {
    return null;
  }

  const res = await jikanGet(`anime/${id}/episodes/${ep}`);
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

  return {
    episode_number: ep,
    name:
      typeof data.title === "string" && data.title.trim()
        ? data.title.trim()
        : null,
    overview: synopsis,
    runtime: duration,
    air_date:
      typeof data.aired === "string" && data.aired.trim() ? data.aired.trim() : null,
    still_path: null,
  };
}

/**
 * Paginated episode list from Jikan v4 (`/anime/{id}/episodes`).
 * List rows include title and air date only — no synopsis or still images.
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
      episodes.push(mapJikanEpisodeListRow(rows[i], (page - 1) * 100 + i + 1));
    }

    if (!json?.pagination?.has_next_page) break;
    page += 1;
    if (page > 20) break;
    await sleep(350);
  }

  episodes.sort((a, b) => a.episode_number - b.episode_number);
  return episodes;
}
