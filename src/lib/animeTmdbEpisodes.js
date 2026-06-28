import clientPromise from "./mongo.js";
import { lookupKometaByMalId } from "./kometaAnimeIds.js";
import { resolveTmdbTvFromDoc } from "./tmdbResolveFromTitle.js";
import { tmdbAuth, tmdbFetchJson } from "./tmdbAuth.js";
import { fetchTmdbSeasonEpisodes } from "./tmdbSeasonEpisodes.js";

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
 * Resolve TMDB TV id + season for a split-cour anime catalog row.
 * @param {Record<string, unknown> | null | undefined} doc
 * @param {number} [malId]
 * @returns {Promise<{ tvId: string, season: number } | null>}
 */
export async function resolveAnimeTmdbEpisodeTarget(doc, malId) {
  const mal =
    pickNumeric(malId) ??
    pickNumeric(doc?.mal_id) ??
    pickNumeric(String(doc?.id ?? "").replace(/^anime_/i, ""));
  if (mal == null) return null;

  const kometa = await lookupKometaByMalId(mal);
  const auth = tmdbAuth();
  const isAnimeRow =
    String(doc?.id ?? "").startsWith("anime_") ||
    doc?.is_anime === true ||
    (Array.isArray(doc?.tags) && doc.tags.includes("anime"));

  // Prefer Kometa/TVDB for split-cour anime — catalog `tmdb_id` is often a wrong
  // one-off special from IMDb backfill (e.g. anime_40028 → 313028).
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
        doc?.external_ids &&
          typeof doc.external_ids === "object" &&
          /** @type {{ tmdb_id?: unknown }} */ (doc.external_ids).tmdb_id
      ) ??
      null;
  }

  const season =
    kometa?.tvdbSeason != null && kometa.tvdbSeason >= 1 ? kometa.tvdbSeason : 1;

  if (!tmdbTvId) return null;
  return { tvId: String(tmdbTvId), season };
}

/**
 * TMDB episode rows for an anime catalog season (MAL id).
 * @param {number} malId
 * @param {number} [limit]
 */
export async function fetchAnimeTmdbEpisodes(malId, limit = 200) {
  const mal = Math.floor(Number(malId));
  const cap = Math.min(500, Math.max(1, Math.floor(Number(limit)) || 200));
  const doc = await findAnimeCatalogDocByMal(mal);
  const target = await resolveAnimeTmdbEpisodeTarget(doc, mal);
  if (!target) {
    return { episodes: [], target: null };
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

  return { episodes, target };
}
