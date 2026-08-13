/**
 * Daily TMDB → Mongo movie sync for `teavie.content`:
 * - Upserts movies whose primary release falls in [today−30d, today+31d] (new + upcoming windows).
 * - Pulls extra ids from now_playing / upcoming lists.
 * - Refreshes oldest-updated released movies already in the DB (stale cap per run).
 *
 * Used by `scripts/sync-movies-tmdb-daily.mjs` and `src/app/api/cron/sync-movies`.
 */
import { MongoClient } from "mongodb";
import { hasTmdbAuth, tmdbAuth, tmdbBearerToken, tmdbFetchJson } from "./tmdbAuth.js";
import {
  shouldRejectTmdbMovieFromCatalog,
  tmdbListMovieLooksAdult,
} from "./tmdbMovieContentPolicy.js";
import { applyImdbGenresToCatalogDoc, omitTmdbGenreFields } from "./imdbGenres.js";

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const FETCH_TIMEOUT_MS = 15000;
const SLEEP_MS = 35;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function tmdbTokenFromEnv() {
  return tmdbBearerToken().trim();
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function mapTmdbMovieToDoc(movie) {
  const id = movie.id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  if (shouldRejectTmdbMovieFromCatalog(movie)) return null;
  const title = movie.title ?? movie.original_title ?? `Movie ${id}`;
  const runtimeMin =
    typeof movie.runtime === "number" && movie.runtime > 0 ? movie.runtime : null;
  return applyImdbGenresToCatalogDoc(
    omitTmdbGenreFields({
      ...movie,
      type: "movie",
      name: title,
      runtimeSeconds:
        runtimeMin != null
          ? runtimeMin * 60
          : typeof movie.runtimeSeconds === "number" && movie.runtimeSeconds > 0
            ? movie.runtimeSeconds
            : null,
      updatedAt: new Date(),
    })
  );
}

async function tmdbGet(pathWithQuery, authOverride) {
  const url = pathWithQuery.startsWith("http")
    ? pathWithQuery
    : `${TMDB_BASE}${pathWithQuery}`;
  const auth =
    typeof authOverride === "string" && authOverride.trim()
      ? authOverride.trim()
      : tmdbAuth();
  return tmdbFetchJson(url, auth, { timeoutMs: FETCH_TIMEOUT_MS });
}

async function discoverMovieIdsInWindow(gteIso, lteIso, maxPages, log, authOverride) {
  const ids = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const q = new URLSearchParams({
      language: "en-US",
      include_adult: "false",
      sort_by: "primary_release_date.desc",
      "primary_release_date.gte": gteIso,
      "primary_release_date.lte": lteIso,
      page: String(page),
    });
    const json = await tmdbGet(`/discover/movie?${q}`, authOverride);
    const results = Array.isArray(json.results) ? json.results : [];
    for (const r of results) {
      if (
        typeof r.id === "number" &&
        r.id > 0 &&
        !tmdbListMovieLooksAdult(r)
      ) {
        ids.add(r.id);
      }
    }
    log(`discover page ${page}/${maxPages}: +${results.length} rows (total ids=${ids.size})`);
    if (results.length === 0 || page >= (json.total_pages || 0)) break;
    await sleep(SLEEP_MS);
  }
  return [...ids];
}

async function listEndpointMovieIds(endpoint, maxPages, log, authOverride) {
  const ids = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const q = new URLSearchParams({
      language: "en-US",
      include_adult: "false",
      page: String(page),
    });
    const json = await tmdbGet(`${endpoint}?${q}`, authOverride);
    const results = Array.isArray(json.results) ? json.results : [];
    for (const r of results) {
      if (
        typeof r.id === "number" &&
        r.id > 0 &&
        !tmdbListMovieLooksAdult(r)
      ) {
        ids.add(r.id);
      }
    }
    log(`${endpoint} page ${page}: +${results.length}`);
    if (results.length === 0 || page >= (json.total_pages || 0)) break;
    await sleep(SLEEP_MS);
  }
  return [...ids];
}

async function fetchMovieDetail(id, authOverride) {
  const q = new URLSearchParams({
    language: "en-US",
    include_adult: "false",
    append_to_response: "release_dates",
  });
  return tmdbGet(`/movie/${id}?${q}`, authOverride);
}

async function bulkUpsertMovies(col, docs, batchSize, dryRun, log) {
  if (docs.length === 0) return { upserted: 0, modified: 0, matched: 0 };
  if (dryRun) {
    log(`dry-run: would upsert ${docs.length} movies`);
    return { upserted: 0, modified: 0, matched: 0 };
  }
  let upserted = 0;
  let modified = 0;
  let matched = 0;
  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize).map((doc) => ({
      updateOne: {
        filter: { type: "movie", id: doc.id },
        update: { $set: doc },
        upsert: true,
      },
    }));
    const r = await col.bulkWrite(chunk, { ordered: false });
    upserted += r.upsertedCount;
    modified += r.modifiedCount;
    matched += r.matchedCount;
    log(`bulk ${Math.min(i + chunk.length, docs.length)}/${docs.length}: upserted+=${r.upsertedCount} modified+=${r.modifiedCount}`);
  }
  return { upserted, modified, matched };
}

/**
 * @param {{
 *   dryRun?: boolean;
 *   staleCap?: number;
 *   maxDiscoverPages?: number;
 *   maxListPages?: number;
 *   bulkBatch?: number;
 *   token?: string;
 *   mongoUri?: string;
 *   onLog?: (msg: string) => void;
 * }} opts
 */
export async function runDailyMovieSync(opts = {}) {
  const dryRun = Boolean(opts.dryRun);
  const staleCap = Math.max(0, Number(opts.staleCap) || 250);
  const missingPosterCap = Math.max(0, Number(opts.missingPosterCap) || 0);
  const maxDiscoverPages = Math.max(1, Number(opts.maxDiscoverPages) || 40);
  const maxListPages = Math.max(1, Number(opts.maxListPages) || 5);
  const bulkBatch = Math.max(20, Number(opts.bulkBatch) || 100);
  const log = opts.onLog || ((m) => console.log(m));

  const authOverride = (opts.token || tmdbTokenFromEnv()).trim() || undefined;
  const uri = (opts.mongoUri || process.env.MONGODB_URI || "").trim();
  if (!hasTmdbAuth() && !authOverride) {
    throw new Error("Missing TMDB_BEARER or TMDB_API_KEY");
  }
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }

  const now = new Date();
  const todayIso = isoDate(now);
  const windowStart = isoDate(addDays(now, -30));
  const windowEnd = isoDate(addDays(now, 31));

  log(
    `movie sync | today=${todayIso} window=[${windowStart}..${windowEnd}] staleCap=${staleCap} missingPosterCap=${missingPosterCap} dryRun=${dryRun}`
  );

  const idSet = new Set();

  const discoverIds = await discoverMovieIdsInWindow(
    windowStart,
    windowEnd,
    maxDiscoverPages,
    log,
    authOverride
  );
  discoverIds.forEach((id) => idSet.add(id));

  const nowPlaying = await listEndpointMovieIds(
    "/movie/now_playing",
    maxListPages,
    log,
    authOverride
  );
  nowPlaying.forEach((id) => idSet.add(id));

  const upcoming = await listEndpointMovieIds(
    "/movie/upcoming",
    maxListPages,
    log,
    authOverride
  );
  upcoming.forEach((id) => idSet.add(id));

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  if (missingPosterCap > 0) {
    const missingDocs = await col
      .find({
        type: "movie",
        $or: [
          { poster_path: { $exists: false } },
          { poster_path: null },
          { poster_path: "" },
        ],
      })
      .project({ id: 1 })
      .limit(missingPosterCap)
      .toArray();
    let missingAdded = 0;
    for (const d of missingDocs) {
      const id = Number(d.id);
      if (Number.isFinite(id) && id > 0) {
        idSet.add(id);
        missingAdded += 1;
      }
    }
    log(
      `missing poster queue: ${missingAdded} movies (limit ${missingPosterCap})`
    );
  }

  if (staleCap > 0) {
    const staleDocs = await col
      .find({
        type: "movie",
        release_date: { $type: "string", $lte: todayIso },
      })
      .project({ id: 1 })
      .sort({ updatedAt: 1 })
      .limit(staleCap)
      .toArray();
    const staleIds = staleDocs
      .map((d) => Number(d.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    staleIds.forEach((id) => idSet.add(id));
    log(`stale queue: ${staleIds.length} released movies (oldest updatedAt first)`);
  }

  const allIds = [...idSet];
  log(`unique TMDB movie ids to fetch: ${allIds.length}`);

  const docs = [];
  let fetchErr = 0;
  for (let i = 0; i < allIds.length; i += 1) {
    const id = allIds[i];
    try {
      const movie = await fetchMovieDetail(id, authOverride);
      const doc = mapTmdbMovieToDoc(movie);
      if (doc) docs.push(doc);
    } catch (e) {
      fetchErr += 1;
      log(`warn: movie ${id} ${e instanceof Error ? e.message : String(e)}`);
    }
    if ((i + 1) % 50 === 0) log(`fetched ${i + 1}/${allIds.length}…`);
    await sleep(SLEEP_MS);
  }

  const stats = await bulkUpsertMovies(col, docs, bulkBatch, dryRun, log);
  await client.close();

  log(
    `done: detail_ok=${docs.length} detail_err=${fetchErr} upserted=${stats.upserted} modified=${stats.modified} matched=${stats.matched}`
  );
  return {
    todayIso,
    windowStart,
    windowEnd,
    uniqueIds: allIds.length,
    detailOk: docs.length,
    detailErr: fetchErr,
    ...stats,
    dryRun,
  };
}
