/**
 * MAL / AniList / TVDb / IMDb / TMDB cross-refs from Kometa Anime-IDs.
 * @see https://github.com/Kometa-Team/Anime-IDs
 */
const KOMETA_ANIME_IDS_URL =
  "https://raw.githubusercontent.com/Kometa-Team/Anime-IDs/master/anime_ids.json";

/** @type {Promise<{ byMal: Map<string, object[]>; byTvdb: Map<string, object[]> }> | null} */
let indexPromise = null;

function firstImdbId(raw) {
  const id = String(raw ?? "")
    .split(",")[0]
    .trim();
  return /^tt\d+$/i.test(id) ? id : null;
}

function malIdsFromRow(row) {
  return String(row?.mal_id ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
}

function buildIndex(raw) {
  /** @type {Map<string, object[]>} */
  const byMal = new Map();
  /** @type {Map<string, object[]>} */
  const byTvdb = new Map();

  for (const [anidb, row] of Object.entries(raw ?? {})) {
    if (!row || typeof row !== "object") continue;
    const entry = { anidb, ...row };
    for (const mal of malIdsFromRow(row)) {
      if (!byMal.has(mal)) byMal.set(mal, []);
      byMal.get(mal).push(entry);
    }
    const tvdb = row.tvdb_id;
    if (tvdb != null && Number.isFinite(Number(tvdb))) {
      const key = String(tvdb);
      if (!byTvdb.has(key)) byTvdb.set(key, []);
      byTvdb.get(key).push(entry);
    }
  }

  return { byMal, byTvdb };
}

function imdbFromKometaRows(rows, byTvdb) {
  if (!rows?.length) return null;
  for (const row of rows) {
    const id = firstImdbId(row.imdb_id);
    if (id) return id;
  }
  const tvdb = rows[0]?.tvdb_id;
  if (tvdb != null) {
    for (const row of byTvdb.get(String(tvdb)) ?? []) {
      const id = firstImdbId(row.imdb_id);
      if (id) return id;
    }
  }
  return null;
}

/**
 * @param {{ byMal: Map<string, object[]>; byTvdb: Map<string, object[]> }} index
 */
export function resolveKometaByMalId(malId, index) {
  const mal = String(Math.floor(Number(malId)));
  if (!/^\d+$/.test(mal) || mal === "0") return null;

  const rows = index.byMal.get(mal);
  if (!rows?.length) return null;

  const primary =
    rows.find((r) => Number(r.mal_id) === Number(mal)) ??
    rows.find((r) => String(r.mal_id ?? "").split(",")[0].trim() === mal) ??
    rows[0];

  return {
    anidbId: primary.anidb ?? null,
    malId: Number(mal),
    anilistId:
      Number.isFinite(Number(primary.anilist_id)) && Number(primary.anilist_id) > 0
        ? Number(primary.anilist_id)
        : null,
    tvdbId:
      Number.isFinite(Number(primary.tvdb_id)) && Number(primary.tvdb_id) > 0
        ? Number(primary.tvdb_id)
        : null,
    /** TVDb season — used as IMDb season hint for split-cour catalog rows. */
    tvdbSeason:
      Number.isFinite(Number(primary.tvdb_season)) && Number(primary.tvdb_season) >= 0
        ? Number(primary.tvdb_season)
        : null,
    tvdbEpOffset:
      Number.isFinite(Number(primary.tvdb_epoffset)) ? Number(primary.tvdb_epoffset) : 0,
    tmdbShowId:
      Number.isFinite(Number(primary.tmdb_show_id)) && Number(primary.tmdb_show_id) > 0
        ? Number(primary.tmdb_show_id)
        : null,
    tmdbMovieId:
      Number.isFinite(Number(primary.tmdb_movie_id)) && Number(primary.tmdb_movie_id) > 0
        ? Number(primary.tmdb_movie_id)
        : null,
    imdbId: imdbFromKometaRows(rows, index.byTvdb),
  };
}

export async function loadKometaAnimeIndex() {
  if (!indexPromise) {
    indexPromise = (async () => {
      const res = await fetch(KOMETA_ANIME_IDS_URL, {
        headers: { Accept: "application/json" },
        next: { revalidate: 86400 },
      });
      if (!res.ok) {
        throw new Error(`Kometa Anime-IDs fetch failed: ${res.status}`);
      }
      const raw = await res.json();
      return buildIndex(raw);
    })();
  }
  return indexPromise;
}

/**
 * @param {number | string | null | undefined} malId
 */
export async function lookupKometaByMalId(malId) {
  try {
    const index = await loadKometaAnimeIndex();
    return resolveKometaByMalId(malId, index);
  } catch {
    return null;
  }
}

/**
 * @param {number | string | null | undefined} malId
 */
export async function kometaImdbIdForMal(malId) {
  const hit = await lookupKometaByMalId(malId);
  return hit?.imdbId ?? null;
}

/**
 * IMDb season hint for a MAL catalog row (split cours on one TVDb series).
 * @param {number | string | null | undefined} malId
 */
export async function kometaImdbSeasonForMal(malId) {
  const hit = await lookupKometaByMalId(malId);
  const season = hit?.tvdbSeason;
  return season != null && season >= 1 ? season : null;
}
