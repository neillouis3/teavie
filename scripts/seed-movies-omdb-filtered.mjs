/**
 * Wipe catalog movies and refill from TMDB **popular** while requiring a passing
 * OMDb lookup by `imdb_id` (genre/rated sanity). Upserts use the same shape as
 * `mapTmdbMovieToDoc` (TMDB fields, `type: "movie"`).
 *
 *   OMDB_API_KEY=… MONGODB_URI=… TMDB_BEARER=… \
 *     node scripts/seed-movies-omdb-filtered.mjs --wipe-movies --pages=15
 *
 *   node scripts/seed-movies-omdb-filtered.mjs --dry-run --pages=2
 *
 * `--wipe-movies` — delete all `teavie.content` docs with `type: "movie"` before seeding.
 * `--dry-run` — no Mongo writes (still calls APIs unless combined with --no-fetch).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { mapTmdbMovieToDoc } from "../src/lib/syncMoviesTmdbDaily.js";
import { tmdbBearerToken } from "../src/lib/tmdbAuth.js";
import { omdbApiKey, omdbQueryWithKey } from "../src/lib/omdbAuth.js";
import { shouldRejectOmdbMovieDetail } from "../src/lib/omdbMoviePolicy.js";
import { tmdbListMovieLooksAdult } from "../src/lib/tmdbMovieContentPolicy.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const OMDB_BASE = "https://www.omdbapi.com/";
const FETCH_TIMEOUT_MS = 20000;
const SLEEP_TMDB_MS = 45;
const SLEEP_OMDB_MS = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function parseIntFlag(name, def) {
  const prefix = `${name}=`;
  const eq = process.argv.find((a) => a.startsWith(prefix));
  if (eq) {
    const n = parseInt(eq.slice(prefix.length), 10);
    if (Number.isFinite(n)) return n;
  }
  return def;
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

async function omdbGetByImdbId(imdbId) {
  const key = omdbApiKey();
  if (!key) throw new Error("Missing OMDB_API_KEY");
  const qs = omdbQueryWithKey({ i: String(imdbId).trim() });
  const url = `${OMDB_BASE}?${qs}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`OMDb ${res.status}: ${txt.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(t);
  }
}

async function popularMovieIds(token, maxPages) {
  const ids = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const q = new URLSearchParams({
      language: "en-US",
      include_adult: "false",
      page: String(page),
    });
    const json = await tmdbGet(`/movie/popular?${q}`, token);
    const results = Array.isArray(json.results) ? json.results : [];
    for (const r of results) {
      if (tmdbListMovieLooksAdult(r)) continue;
      const id = Number(r.id);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    if (results.length === 0 || page >= (json.total_pages || 0)) break;
    await sleep(SLEEP_TMDB_MS);
  }
  return ids;
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const wipeMovies = hasFlag("--wipe-movies");
  const pages = Math.max(1, parseIntFlag("--pages", 10));

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  const tmdbToken = tmdbBearerToken().trim();
  const omdbKey = omdbApiKey();

  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!tmdbToken) {
    console.error("Missing TMDB_BEARER (or NEXT_PUBLIC_TMDB_BEARER)");
    process.exit(1);
  }
  if (!omdbKey) {
    console.error("Missing OMDB_API_KEY (add to .env.local — do not commit the key)");
    process.exit(1);
  }

  console.log(
    `seed movies (OMDb gate) | mongo=${mongoHostHint(uri)} pages=${pages} wipe=${wipeMovies} dryRun=${dryRun}`
  );

  const movieIds = await popularMovieIds(tmdbToken, pages);
  console.log(`TMDB popular movie ids: ${movieIds.length}`);

  const ops = [];
  let skippedNoImdb = 0;
  let skippedOmdbReject = 0;
  let skippedTmdbNull = 0;
  let omdbErr = 0;

  for (let i = 0; i < movieIds.length; i += 1) {
    const mid = movieIds[i];
    try {
      const mq = new URLSearchParams({
        language: "en-US",
        include_adult: "false",
        append_to_response: "release_dates",
      });
      const movie = await tmdbGet(`/movie/${mid}?${mq}`, tmdbToken);
      const imdbRaw = movie.imdb_id;
      const imdbId =
        typeof imdbRaw === "string" && /^tt\d+$/i.test(imdbRaw.trim())
          ? imdbRaw.trim()
          : null;
      if (!imdbId) {
        skippedNoImdb += 1;
        await sleep(SLEEP_TMDB_MS);
        continue;
      }

      const omdb = await omdbGetByImdbId(imdbId);
      await sleep(SLEEP_OMDB_MS);

      if (shouldRejectOmdbMovieDetail(omdb)) {
        skippedOmdbReject += 1;
        await sleep(SLEEP_TMDB_MS);
        continue;
      }

      const doc = mapTmdbMovieToDoc(movie);
      if (!doc) {
        skippedTmdbNull += 1;
        await sleep(SLEEP_TMDB_MS);
        continue;
      }

      ops.push({
        updateOne: {
          filter: { type: "movie", id: doc.id },
          update: { $set: doc },
          upsert: true,
        },
      });
    } catch (e) {
      omdbErr += 1;
      console.warn(`movie ${mid}: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(SLEEP_TMDB_MS);
    if ((i + 1) % 25 === 0) {
      console.log(`  processed ${i + 1}/${movieIds.length}…`);
    }
  }

  console.log(
    `candidates: upsertOps=${ops.length} skipNoImdb=${skippedNoImdb} skipOmdbPolicy=${skippedOmdbReject} skipTmdbPolicy=${skippedTmdbNull} errors=${omdbErr}`
  );

  if (dryRun) {
    console.log("dry-run: no Mongo writes");
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  if (wipeMovies) {
    const wr = await col.deleteMany({ type: "movie" });
    console.log(`wiped movies: deletedCount=${wr.deletedCount}`);
  }

  if (ops.length === 0) {
    console.log("nothing to upsert");
    await client.close();
    return;
  }

  const batch = 100;
  let upserted = 0;
  let modified = 0;
  for (let i = 0; i < ops.length; i += batch) {
    const chunk = ops.slice(i, i + batch);
    const r = await col.bulkWrite(chunk, { ordered: false });
    upserted += r.upsertedCount;
    modified += r.modifiedCount;
    console.log(
      `bulk ${Math.min(i + chunk.length, ops.length)}/${ops.length}: upserted+=${r.upsertedCount} modified+=${r.modifiedCount}`
    );
  }
  console.log(`done: upserted=${upserted} modified=${modified}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
