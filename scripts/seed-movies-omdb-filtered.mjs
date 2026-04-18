/**
 * Movie catalog seed: **list** comes from **OMDb Search** (paginated `s=` + `type=movie`);
 * each title is gated with OMDb **detail** `?i=tt…`; **full document** is built from **TMDB**
 * (`/find` by IMDb id → `/movie/{id}`) so Mongo keeps the same shape as `mapTmdbMovieToDoc`.
 *
 *   OMDB_API_KEY=… MONGODB_URI=… TMDB_BEARER=… \
 *     node scripts/seed-movies-omdb-filtered.mjs --wipe-movies --omdb-search=war,love,night
 *
 *   node scripts/seed-movies-omdb-filtered.mjs --dry-run --pages-per-search=3
 *
 * `--omdb-search=a,b,c` — comma-separated OMDb title search strings (default: broad set below).
 * `--pages-per-search=N` — max OMDb search page per term (10 hits/page; default 5).
 * `--max-titles=N` — cap unique IMDb ids after merging searches (default 800).
 * `--wipe-movies` — delete all `type: "movie"` before upserting.
 * `--dry-run` — no Mongo writes.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { mapTmdbMovieToDoc } from "../src/lib/syncMoviesTmdbDaily.js";
import { tmdbBearerToken } from "../src/lib/tmdbAuth.js";
import { omdbApiKey, omdbQueryWithKey } from "../src/lib/omdbAuth.js";
import { shouldRejectOmdbMovieDetail } from "../src/lib/omdbMoviePolicy.js";

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

/** Default OMDb `s=` terms — wide, mainstream-heavy overlap; override with `--omdb-search=`. */
const DEFAULT_OMDB_SEARCHES = [
  "war",
  "love",
  "man",
  "night",
  "home",
  "star",
  "last",
  "life",
  "world",
  "city",
];

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

function parseOmdbSearchTerms() {
  const prefix = "--omdb-search=";
  const eq = process.argv.find((a) => a.startsWith(prefix));
  if (eq) {
    const raw = eq.slice(prefix.length).trim();
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts;
  }
  return [...DEFAULT_OMDB_SEARCHES];
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

async function omdbFetch(params) {
  const key = omdbApiKey();
  if (!key) throw new Error("Missing OMDB_API_KEY");
  const qs = omdbQueryWithKey(params);
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

/**
 * Paginate OMDb search for one `s=` term; returns unique `tt…` ids in page order.
 * @param {string} term
 * @param {number} maxPages
 */
async function omdbSearchImdbIds(term, maxPages) {
  const out = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const json = await omdbFetch({
      s: term,
      type: "movie",
      page: String(page),
    });
    await sleep(SLEEP_OMDB_MS);
    if (String(json.Response ?? "").toLowerCase() === "false") break;
    const rows = Array.isArray(json.Search) ? json.Search : [];
    if (rows.length === 0) break;
    for (const row of rows) {
      const id = String(row.imdbID ?? "").trim();
      if (!/^tt\d+$/i.test(id) || seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    if (rows.length < 10) break;
  }
  return out;
}

/** TMDB movie id from IMDb id, or null. */
async function tmdbFindMovieIdByImdb(imdbId, token) {
  const enc = encodeURIComponent(imdbId.trim());
  const json = await tmdbGet(
    `/find/${enc}?external_source=imdb_id&language=en-US`,
    token
  );
  await sleep(SLEEP_TMDB_MS);
  const results = Array.isArray(json.movie_results) ? json.movie_results : [];
  const first = results[0];
  const mid = first?.id;
  return typeof mid === "number" && Number.isFinite(mid) && mid > 0 ? mid : null;
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const wipeMovies = hasFlag("--wipe-movies");
  const pagesPerSearch = Math.max(1, parseIntFlag("--pages-per-search", 5));
  const maxTitles = Math.max(10, parseIntFlag("--max-titles", 800));

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

  const searchTerms = parseOmdbSearchTerms();

  console.log(
    `seed movies (OMDb list → TMDB body) | mongo=${mongoHostHint(uri)} terms=${searchTerms.length} pagesPerSearch=${pagesPerSearch} maxTitles=${maxTitles} wipe=${wipeMovies} dryRun=${dryRun}`
  );
  console.log(`omdb s= terms: ${searchTerms.join(" | ")}`);

  /** @type {string[]} */
  const imdbIds = [];
  const seenImdb = new Set();
  for (const term of searchTerms) {
    if (imdbIds.length >= maxTitles) break;
    const chunk = await omdbSearchImdbIds(term, pagesPerSearch);
    for (const id of chunk) {
      if (imdbIds.length >= maxTitles) break;
      if (seenImdb.has(id)) continue;
      seenImdb.add(id);
      imdbIds.push(id);
    }
    console.log(`  search "${term}": +${chunk.length} imdb ids (running total ${imdbIds.length})`);
  }

  console.log(`unique IMDb ids to process: ${imdbIds.length}`);

  const ops = [];
  let skippedOmdbReject = 0;
  let skippedNoTmdbFind = 0;
  let skippedTmdbNull = 0;
  let err = 0;

  for (let i = 0; i < imdbIds.length; i += 1) {
    const imdbId = imdbIds[i];
    try {
      const omdb = await omdbFetch({ i: imdbId });
      await sleep(SLEEP_OMDB_MS);

      if (shouldRejectOmdbMovieDetail(omdb)) {
        skippedOmdbReject += 1;
        continue;
      }

      const tmdbId = await tmdbFindMovieIdByImdb(imdbId, tmdbToken);
      if (tmdbId == null) {
        skippedNoTmdbFind += 1;
        continue;
      }

      const mq = new URLSearchParams({
        language: "en-US",
        include_adult: "false",
        append_to_response: "release_dates",
      });
      const movie = await tmdbGet(`/movie/${tmdbId}?${mq}`, tmdbToken);
      await sleep(SLEEP_TMDB_MS);

      const doc = mapTmdbMovieToDoc(movie);
      if (!doc) {
        skippedTmdbNull += 1;
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
      err += 1;
      console.warn(`${imdbId}: ${e instanceof Error ? e.message : e}`);
    }
    if ((i + 1) % 40 === 0) {
      console.log(`  processed ${i + 1}/${imdbIds.length}…`);
    }
  }

  console.log(
    `candidates: upsertOps=${ops.length} skipOmdbPolicy=${skippedOmdbReject} skipNoTmdbFind=${skippedNoTmdbFind} skipTmdbPolicy=${skippedTmdbNull} errors=${err}`
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
  for (let j = 0; j < ops.length; j += batch) {
    const chunk = ops.slice(j, j + batch);
    const r = await col.bulkWrite(chunk, { ordered: false });
    upserted += r.upsertedCount;
    modified += r.modifiedCount;
    console.log(
      `bulk ${Math.min(j + chunk.length, ops.length)}/${ops.length}: upserted+=${r.upsertedCount} modified+=${r.modifiedCount}`
    );
  }
  console.log(`done: upserted=${upserted} modified=${modified}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
