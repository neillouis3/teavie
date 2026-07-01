import clientPromise from "./mongo.js";
import { lookupKometaByMalId } from "./kometaAnimeIds.js";
import { resolveTmdbTvFromDoc } from "./tmdbResolveFromTitle.js";
import { tmdbAuth, tmdbFetchJson } from "./tmdbAuth.js";
import { fetchTmdbSeasonEpisodes } from "./tmdbSeasonEpisodes.js";
import { tmdbSeasonEpisodeFromAbsolute } from "./cumulativeTvEpisode";
import {
  mergedSplitCourEpisodeCount,
  normalizeSplitCourMalEpisode,
  primaryMalForSplitCourMal,
  resolveSplitCourPlayback,
  splitCourGroupForMal,
} from "./animeSplitCour.js";

function pickNumeric(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string") {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/**
 * @param {number} malId
 */
export async function findAnimeCatalogDocByMal(malId) {
  const mal = Math.floor(Number(malId));
  if (!Number.isFinite(mal) || mal <= 0) return null;

  const client = await clientPromise;
  const col = client.db("teavie").collection("content");
  return col.findOne({
    type: "tv",
    $or: [{ mal_id: mal }, { mal_id: String(mal) }, { id: `anime_${mal}` }],
  });
}

/**
 * @param {number | string} tvdbId
 * @param {string | { bearer?: string; apiKey?: string }} auth
 */
async function tmdbTvIdFromTvdb(tvdbId, auth) {
  const id = Math.floor(Number(tvdbId));
  if (!Number.isFinite(id) || id <= 0) return null;
  try {
    const data = await tmdbFetchJson(
      `https://api.themoviedb.org/3/find/${id}?external_source=tvdb_id`,
      auth
    );
    const hit = Array.isArray(data?.tv_results) ? data.tv_results[0] : null;
    return pickNumeric(hit?.id);
  } catch {
    return null;
  }
}

/**
 * @param {number | string} tvId
 */
export async function fetchTmdbTvSeasonMeta(tvId) {
  const id = String(tvId ?? "").trim();
  if (!/^\d+$/.test(id)) return { tvId: id, seasons: [], totalEpisodes: 0 };

  const auth = tmdbAuth();
  if (!auth) return { tvId: id, seasons: [], totalEpisodes: 0 };

  try {
    const json = await tmdbFetchJson(
      `https://api.themoviedb.org/3/tv/${id}?language=en-US`,
      auth,
      { timeoutMs: 15000 }
    );
    const seasons = (json.seasons ?? [])
      .filter(
        (s) =>
          s.season_number >= 1 &&
          typeof s.episode_count === "number" &&
          s.episode_count > 0
      )
      .sort((a, b) => a.season_number - b.season_number)
      .map((s) => ({
        season_number: s.season_number,
        episode_count: s.episode_count,
        name: typeof s.name === "string" ? s.name : null,
      }));
    const totalEpisodes = seasons.reduce(
      (acc, s) => acc + (s.episode_count ?? 0),
      0
    );
    return {
      tvId: id,
      seasons,
      totalEpisodes,
      number_of_episodes:
        typeof json.number_of_episodes === "number" && json.number_of_episodes > 0
          ? json.number_of_episodes
          : totalEpisodes,
    };
  } catch {
    return { tvId: id, seasons: [], totalEpisodes: 0 };
  }
}

/**
 * @param {Awaited<ReturnType<typeof lookupKometaByMalId>>} kometa
 * @param {{ seasons: { season_number: number; episode_count?: number }[] }} meta
 * @param {number} targetSeason
 */
export function shouldFlattenAnimeTmdbEpisodes(kometa, meta, targetSeason) {
  if (kometa?.allSeasonsFlat) return true;
  if (kometa?.tvdbSeason != null && kometa.tvdbSeason >= 1) return false;

  const seasons = meta?.seasons ?? [];
  if (seasons.length <= 1) return false;

  const targetMeta = seasons.find((s) => s.season_number === targetSeason);
  const targetCount = targetMeta?.episode_count ?? 0;
  const total = seasons.reduce((acc, s) => acc + (s.episode_count ?? 0), 0);
  return total > targetCount;
}

/**
 * Flatten TMDB seasons into absolute episode numbers (anime-style one season).
 * @param {number | string} tvId
 * @param {number} cap
 */
export async function fetchAnimeTmdbFlatEpisodes(tvId, cap = 500) {
  const limit = Math.min(1500, Math.max(1, Math.floor(Number(cap)) || 500));
  const meta = await fetchTmdbTvSeasonMeta(tvId);
  const episodes = [];

  for (const season of meta.seasons) {
    const rows = await fetchTmdbSeasonEpisodes(tvId, season.season_number);
    for (const row of rows) {
      episodes.push({
        episode_number: episodes.length + 1,
        name: row.name,
        overview: row.overview,
        runtime: row.runtime,
        still_path: row.still_path,
        air_date: row.air_date,
      });
      if (episodes.length >= limit) break;
    }
    if (episodes.length >= limit) break;
  }

  return {
    episodes,
    target: {
      tvId: String(tvId),
      flat: true,
      seasons: meta.seasons,
    },
    totalEpisodes: meta.totalEpisodes || meta.number_of_episodes || episodes.length,
  };
}

/**
 * Resolve TMDB TV id + season for a split-cour anime catalog row.
 * @param {Record<string, unknown> | null | undefined} doc
 * @param {number} [malId]
 * @returns {Promise<{ tvId: string, season: number } | null>}
 */
export async function resolveAnimeTmdbEpisodeTarget(doc, malId, absoluteEpisode = 1) {
  const normalized = normalizeSplitCourMalEpisode(malId, absoluteEpisode);
  const mal = normalized.malId ??
    pickNumeric(malId) ??
    pickNumeric(doc?.mal_id) ??
    pickNumeric(String(doc?.id ?? "").replace(/^anime_/i, ""));
  const absEpisode = normalized.episode;
  if (mal == null) return null;

  const group = splitCourGroupForMal(mal);
  if (group) {
    const playback = resolveSplitCourPlayback(group, absEpisode);
    return {
      tvId: playback.tmdbTvId,
      season: playback.tmdbSeason,
      episode: playback.tmdbEpisode,
      malId: playback.malId,
      malEpisode: playback.malEpisode,
    };
  }

  const kometa = await lookupKometaByMalId(mal);
  const auth = tmdbAuth();
  const isAnimeRow =
    String(doc?.id ?? "").startsWith("anime_") ||
    doc?.is_anime === true ||
    (Array.isArray(doc?.tags) && doc.tags.includes("anime"));

  let tmdbTvId = kometa?.tmdbShowId ?? null;

  if (!tmdbTvId && kometa?.tvdbId && auth) {
    tmdbTvId = await tmdbTvIdFromTvdb(kometa.tvdbId, auth);
  }

  if (!tmdbTvId && doc && auth) {
    const imdbId =
      kometa?.imdbId ??
      (typeof doc.imdb_id === "string" ? doc.imdb_id : null) ??
      (doc.external_ids &&
      typeof doc.external_ids === "object" &&
      typeof /** @type {{ imdb_id?: unknown }} */ (doc.external_ids).imdb_id ===
        "string"
        ? /** @type {{ imdb_id: string }} */ (doc.external_ids).imdb_id
        : null);

    const hit = await resolveTmdbTvFromDoc(doc, auth, { imdbId });
    if (hit?.tmdbId) tmdbTvId = hit.tmdbId;
  }

  if (!tmdbTvId && !isAnimeRow) {
    tmdbTvId =
      pickNumeric(doc?.tmdb_id) ??
      pickNumeric(
        doc.external_ids &&
          typeof doc.external_ids === "object" &&
          /** @type {{ tmdb_id?: unknown }} */ (doc.external_ids).tmdb_id
      ) ??
      null;
  }

  if (!tmdbTvId && isAnimeRow) {
    tmdbTvId = pickNumeric(doc?.tmdb_id) ?? null;
  }

  if (!tmdbTvId) return null;

  const meta = await fetchTmdbTvSeasonMeta(tmdbTvId);
  const defaultSeason =
    kometa?.tvdbSeason != null && kometa.tvdbSeason >= 1 ? kometa.tvdbSeason : 1;
  const flatten = shouldFlattenAnimeTmdbEpisodes(kometa, meta, defaultSeason);

  if (flatten) {
    const mapped = tmdbSeasonEpisodeFromAbsolute(meta.seasons, absEpisode);
    return {
      tvId: String(tmdbTvId),
      season: mapped.season,
      episode: mapped.episode,
      flat: true,
      absoluteEpisode: absEpisode,
      playbackSeasons: meta.seasons,
    };
  }

  const season = defaultSeason;
  return {
    tvId: String(tmdbTvId),
    season,
    episode: Math.max(1, Math.floor(Number(absoluteEpisode)) || 1),
    flat: false,
    playbackSeasons: meta.seasons,
  };
}

/**
 * TMDB episode rows for an anime catalog season (MAL id).
 * @param {number} malId
 * @param {number} [limit]
 */
export async function fetchAnimeTmdbEpisodes(malId, limit = 200) {
  const mal = Math.floor(Number(malId));
  const effectiveMal = primaryMalForSplitCourMal(mal) ?? mal;
  const cap = Math.min(1500, Math.max(1, Math.floor(Number(limit)) || 200));
  const group = splitCourGroupForMal(effectiveMal);

  if (group && group.primaryMalId === effectiveMal) {
    const mergedCap = Math.min(cap, mergedSplitCourEpisodeCount(group));
    const rows = await fetchTmdbSeasonEpisodes(group.tmdbTvId, group.tmdbSeason);
    const episodes = rows.slice(0, mergedCap).map((row) => ({
      episode_number: row.episode_number,
      name: row.name,
      overview: row.overview,
      runtime: row.runtime,
      still_path: row.still_path,
      air_date: row.air_date,
    }));
    return {
      episodes,
      target: {
        tvId: String(group.tmdbTvId),
        season: group.tmdbSeason,
        merged: true,
      },
      totalEpisodes: mergedSplitCourEpisodeCount(group),
      flat: false,
    };
  }

  const doc = await findAnimeCatalogDocByMal(effectiveMal);
  const kometa = await lookupKometaByMalId(effectiveMal);
  const target = await resolveAnimeTmdbEpisodeTarget(doc, effectiveMal);
  if (!target) {
    return { episodes: [], target: null, totalEpisodes: 0, flat: false };
  }

  const meta = await fetchTmdbTvSeasonMeta(target.tvId);
  const flatten = shouldFlattenAnimeTmdbEpisodes(
    kometa,
    meta,
    target.season ?? 1
  );

  if (flatten) {
    const flat = await fetchAnimeTmdbFlatEpisodes(target.tvId, cap);
    return {
      episodes: flat.episodes,
      target: flat.target,
      totalEpisodes: flat.totalEpisodes,
      flat: true,
    };
  }

  const rows = await fetchTmdbSeasonEpisodes(target.tvId, target.season);
  const episodes = rows.slice(0, cap).map((row) => ({
    episode_number: row.episode_number,
    name: row.name,
    overview: row.overview,
    runtime: row.runtime,
    still_path: row.still_path,
    air_date: row.air_date,
  }));

  return {
    episodes,
    target,
    totalEpisodes: rows.length,
    flat: false,
  };
}

/**
 * Absolute episode total for anime UI (AniList / catalog / flattened TMDB).
 * @param {Record<string, unknown> | null | undefined} doc
 * @param {number} [malId]
 */
export async function fetchAnimeCatalogEpisodeTotal(doc, malId) {
  const mal =
    pickNumeric(malId) ??
    pickNumeric(doc?.mal_id) ??
    pickNumeric(String(doc?.id ?? "").replace(/^anime_/i, ""));
  if (mal == null) return null;

  const group = splitCourGroupForMal(mal);
  if (group && group.primaryMalId === (primaryMalForSplitCourMal(mal) ?? mal)) {
    return mergedSplitCourEpisodeCount(group);
  }

  const fromDoc =
    typeof doc?.number_of_episodes === "number" && doc.number_of_episodes > 0
      ? doc.number_of_episodes
      : null;
  if (fromDoc != null) return fromDoc;

  const fromAni = doc?.anilist?.episodes;
  if (typeof fromAni === "number" && Number.isFinite(fromAni) && fromAni > 0) {
    return fromAni;
  }

  const target = await resolveAnimeTmdbEpisodeTarget(doc, mal);
  if (!target?.tvId) return null;

  const meta = await fetchTmdbTvSeasonMeta(target.tvId);
  const kometa = await lookupKometaByMalId(mal);
  const flatten = shouldFlattenAnimeTmdbEpisodes(kometa, meta, target.season ?? 1);
  if (flatten) {
    const total = meta.totalEpisodes || meta.number_of_episodes;
    return total > 0 ? total : null;
  }

  const seasonMeta = meta.seasons.find((s) => s.season_number === target.season);
  return seasonMeta?.episode_count ?? null;
}

/**
 * TMDB season breakdown for mapping absolute UI episodes → embed season/episode.
 * @param {Record<string, unknown> | null | undefined} doc
 * @param {number} [malId]
 */
export async function fetchAnimeTmdbPlaybackSeasons(doc, malId) {
  const target = await resolveAnimeTmdbEpisodeTarget(doc, malId);
  if (!target?.tvId) return [];

  if (Array.isArray(target.playbackSeasons) && target.playbackSeasons.length > 0) {
    return target.playbackSeasons;
  }

  const meta = await fetchTmdbTvSeasonMeta(target.tvId);
  return meta.seasons;
}
