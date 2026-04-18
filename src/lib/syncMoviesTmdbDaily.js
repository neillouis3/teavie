/**
 * Daily TMDB → Mongo movie sync for `teavie.content`:
 * - Upserts movies whose primary release falls in [today−30d, today+31d] (new + upcoming windows).
 * - Pulls extra ids from now_playing / upcoming lists.
 * - Refreshes oldest-updated released movies already in the DB (stale cap per run).
 *
 * Used by `scripts/sync-movies-tmdb-daily.mjs` and `src/app/api/cron/sync-movies`.
 */
import { MongoClient } from "mongodb";

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const FETCH_TIMEOUT_MS = 15000;
const SLEEP_MS = 35;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function tmdbTokenFromEnv() {
  return (
    process.env.TMDB_BEARER ||
    process.env.NEXT_PUBLIC_TMDB_BEARER ||
    ""
  ).trim();
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
  const title = movie.title ?? movie.original_title ?? `Movie ${id}`;
  return {
    ...movie,
    type: "movie",
    name: title,
    updatedAt: new Date(),
  };
}

async function tmdbGet(pathWithQuery, token) {
  const url = pathWithQuery.startsWith("http")
    ? pathWithQuery
    : `${TMDB_BASE}${pathWithQuery}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`TMDB ${res.status}: ${txt.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

async function discoverMovieIdsInWindow(token, gteIso, lteIso, maxPages, log) {
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
    const json = await tmdbGet(`/discover/movie?${q}`, token);
    const results = Array.isArray(json.results) ? json.results : [];
    for (const r of results) {
      if (typeof r.id === "number" && r.id > 0) ids.add(r.id);
    }
    log(`discover page ${page}/${maxPages}: +${results.length} rows (total ids=${ids.size})`);
    if (results.length === 0 || page >= (json.total_pages || 0)) break;
    await sleep(SLEEP_MS);
  }
  return [...ids];
}

async function listEndpointMovieIds(endpoint, token, maxPages, log) {
  const ids = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const q = new URLSearchParams({
      language: "en-US",
      include_adult: "false",
      page: String(page),
    });
    const json = await tmdbGet(`${endpoint}?${q}`, token);
    const results = Array.isArray(json.results) ? json.results : [];
    for (const r of results) {
      if (typeof r.id === "number" && r.id > 0) ids.add(r.id);
    }
    log(`${endpoint} page ${page}: +${results.length}`);
    if (results.length === 0 || page >= (json.total_pages || 0)) break;
    await sleep(SLEEP_MS);
  }
  return [...ids];
}

async function fetchMovieDetail(id, token) {
  const q = new URLSearchParams({ language: "en-US", include_adult: "false" });
  return tmdbGet(`/movie/${id}?${q}`, token);
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
  const maxDiscoverPages = Math.max(1, Number(opts.maxDiscoverPages) || 40);
  const maxListPages = Math.max(1, Number(opts.maxListPages) || 5);
  const bulkBatch = Math.max(20, Number(opts.bulkBatch) || 100);
  const log = opts.onLog || ((m) => console.log(m));

  const token = (opts.token || tmdbTokenFromEnv()).trim();
  const uri = (opts.mongoUri || process.env.MONGODB_URI || "").trim();
  if (!token) {
    throw new Error("Missing TMDB_BEARER (or NEXT_PUBLIC_TMDB_BEARER)");
  }
  if (!uri) {
    throw new Error("Missing MONGODB_URI");
  }

  const now = new Date();
  const todayIso = isoDate(now);
  const windowStart = isoDate(addDays(now, -30));
  const windowEnd = isoDate(addDays(now, 31));

  log(
    `movie sync | today=${todayIso} window=[${windowStart}..${windowEnd}] staleCap=${staleCap} dryRun=${dryRun}`
  );

  const idSet = new Set();

  const discoverIds = await discoverMovieIdsInWindow(
    token,
    windowStart,
    windowEnd,
    maxDiscoverPages,
    log
  );
  discoverIds.forEach((id) => idSet.add(id));

  const nowPlaying = await listEndpointMovieIds(
    "/movie/now_playing",
    token,
    maxListPages,
    log
  );
  nowPlaying.forEach((id) => idSet.add(id));

  const upcoming = await listEndpointMovieIds(
    "/movie/upcoming",
    token,
    maxListPages,
    log
  );
  upcoming.forEach((id) => idSet.add(id));

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

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
      const movie = await fetchMovieDetail(id, token);
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
