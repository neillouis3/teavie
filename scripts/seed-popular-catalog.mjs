/**
 * Upsert popular TMDB movies + TV into `teavie.content` so Discover/Search rails fill.
 *
 * TV: skips TMDB ids already owned by catalog anime (anime_* / is_anime / tags + tmdb mapping).
 *
 *   node scripts/seed-popular-catalog.mjs
 *   node scripts/seed-popular-catalog.mjs --dry-run --pages=5
 *
 * Env: MONGODB_URI, TMDB_BEARER (or NEXT_PUBLIC_TMDB_BEARER) — see scripts/lib/mongoEnv.cjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { mapTmdbMovieToDoc } from "../src/lib/syncMoviesTmdbDaily.js";
import { tmdbBearerToken } from "../src/lib/tmdbAuth.js";
import {
  shouldRejectTmdbTvFromCatalog,
  tmdbListMovieLooksAdult,
} from "../src/lib/tmdbMovieContentPolicy.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const FETCH_TIMEOUT_MS = 20000;
const SLEEP_MS = 40;

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
  const idx = process.argv.indexOf(name);
  if (idx !== -1) {
    const n = parseInt(process.argv[idx + 1] ?? "", 10);
    if (Number.isFinite(n)) return n;
  }
  return def;
}

function mapTmdbTvToDoc(show) {
  const id = show.id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  if (shouldRejectTmdbTvFromCatalog(show)) return null;
  const name = show.name ?? show.original_name ?? `TV ${id}`;
  return {
    ...show,
    type: "tv",
    id,
    name,
    title: show.name ?? name,
    tmdb_id: id,
    updatedAt: new Date(),
    /** Explicit non-anime seed row (anime stays on `anime_*` ids). */
    is_anime: false,
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

/** TMDB ids already represented as catalog anime — do not upsert numeric TV for these. */
async function animeClaimedTmdbIds(col) {
  const blocked = new Set();
  const cursor = col.find(
    {
      type: "tv",
      $or: [
        { id: { $regex: "^anime_" } },
        { is_anime: true },
        { tags: "anime" },
      ],
    },
    { projection: { id: 1, tmdb_id: 1, external_ids: 1, is_anime: 1, tags: 1 } }
  );

  for await (const d of cursor) {
    const tid = typeof d.tmdb_id === "number" ? d.tmdb_id : Number(d.tmdb_id);
    if (Number.isFinite(tid) && tid > 0) blocked.add(tid);
    const ext = d.external_ids?.tmdb_id;
    const extn = typeof ext === "number" ? ext : Number(ext);
    if (Number.isFinite(extn) && extn > 0) blocked.add(extn);
    const idNum = typeof d.id === "number" ? d.id : Number(d.id);
    if (
      Number.isFinite(idNum) &&
      idNum > 0 &&
      !String(d.id ?? "").startsWith("anime_") &&
      (d.is_anime === true || (Array.isArray(d.tags) && d.tags.includes("anime")))
    ) {
      blocked.add(idNum);
    }
  }
  return blocked;
}

async function popularIds(endpoint, token, maxPages, listRowSkip) {
  const ids = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const q = new URLSearchParams({
      language: "en-US",
      include_adult: "false",
      page: String(page),
    });
    const json = await tmdbGet(`${endpoint}?${q}`, token);
    const results = Array.isArray(json.results) ? json.results : [];
    for (const r of results) {
      if (listRowSkip && listRowSkip(r)) continue;
      const id = Number(r.id);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    if (results.length === 0 || page >= (json.total_pages || 0)) break;
    await sleep(SLEEP_MS);
  }
  return ids;
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const pages = Math.max(1, parseIntFlag("--pages", 3));
  const moviesOnly = hasFlag("--movies-only");
  const tvOnly = hasFlag("--tv-only");

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  const token = tmdbBearerToken().trim();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!token) {
    console.error("Missing TMDB_BEARER (or NEXT_PUBLIC_TMDB_BEARER)");
    process.exit(1);
  }

  console.log(
    `seed popular | mongo=${mongoHostHint(uri)} pages=${pages} dryRun=${dryRun} movies=${!tvOnly} tv=${!moviesOnly}`
  );

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  let animeBlocked = new Set();
  if (!moviesOnly) {
    animeBlocked = await animeClaimedTmdbIds(col);
    console.log(`anime-blocked TMDB tv ids: ${animeBlocked.size}`);
  }

  const ops = [];

  if (!tvOnly) {
    const movieIds = await popularIds("/movie/popular", token, pages, (r) =>
      tmdbListMovieLooksAdult(r)
    );
    console.log(`popular movies: ${movieIds.length} ids`);
    let ok = 0;
    let err = 0;
    for (let i = 0; i < movieIds.length; i += 1) {
      const id = movieIds[i];
      try {
        const q = new URLSearchParams({
          language: "en-US",
          include_adult: "false",
          append_to_response: "release_dates",
        });
        const movie = await tmdbGet(`/movie/${id}?${q}`, token);
        const doc = mapTmdbMovieToDoc(movie);
        if (doc) {
          ops.push({
            updateOne: {
              filter: { type: "movie", id: doc.id },
              update: { $set: doc },
              upsert: true,
            },
          });
          ok += 1;
        }
      } catch (e) {
        err += 1;
        console.warn(`movie ${id}: ${e instanceof Error ? e.message : e}`);
      }
      await sleep(SLEEP_MS);
      if ((i + 1) % 20 === 0) console.log(`  movies fetched ${i + 1}/${movieIds.length}…`);
    }
    console.log(`movies detail ok=${ok} err=${err}`);
  }

  if (!moviesOnly) {
    const tvIds = await popularIds("/tv/popular", token, pages, (r) =>
      shouldRejectTmdbTvFromCatalog(r)
    );
    const toFetch = tvIds.filter((id) => !animeBlocked.has(id));
    console.log(
      `popular tv: ${tvIds.length} ids (${tvIds.length - toFetch.length} skipped — already anime in catalog)`
    );
    let ok = 0;
    let err = 0;
    for (let i = 0; i < toFetch.length; i += 1) {
      const id = toFetch[i];
      try {
        const q = new URLSearchParams({ language: "en-US", include_adult: "false" });
        const show = await tmdbGet(`/tv/${id}?${q}`, token);
        const doc = mapTmdbTvToDoc(show);
        if (doc) {
          ops.push({
            updateOne: {
              filter: { type: "tv", id: doc.id },
              update: { $set: doc },
              upsert: true,
            },
          });
          ok += 1;
        }
      } catch (e) {
        err += 1;
        console.warn(`tv ${id}: ${e instanceof Error ? e.message : e}`);
      }
      await sleep(SLEEP_MS);
      if ((i + 1) % 20 === 0) console.log(`  tv fetched ${i + 1}/${toFetch.length}…`);
    }
    console.log(`tv detail ok=${ok} err=${err}`);
  }

  if (ops.length === 0) {
    console.log("nothing to write");
    await client.close();
    return;
  }

  if (dryRun) {
    console.log(`dry-run: would bulkWrite ${ops.length} ops`);
    await client.close();
    return;
  }

  const batch = 100;
  let upserted = 0;
  let modified = 0;
  let matched = 0;
  for (let i = 0; i < ops.length; i += batch) {
    const chunk = ops.slice(i, i + batch);
    const r = await col.bulkWrite(chunk, { ordered: false });
    upserted += r.upsertedCount;
    modified += r.modifiedCount;
    matched += r.matchedCount;
    console.log(
      `bulk ${Math.min(i + chunk.length, ops.length)}/${ops.length}: upserted+=${r.upsertedCount} modified+=${r.modifiedCount}`
    );
  }
  console.log(`done: upserted=${upserted} modified=${modified} matched=${matched}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
