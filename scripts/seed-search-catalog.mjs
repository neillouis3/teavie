/**
 * Targeted catalog seed by title search for movies OR TV shows. Popular/discover
 * seeds miss niche titles (e.g. the show "Off Campus"), so this pulls a specific
 * query straight from TMDB **search**, fetches full details, and upserts with the
 * same doc shapes used by seed-popular-catalog / syncMoviesTmdbDaily.
 *
 *   node scripts/seed-search-catalog.mjs --type=tv --query="off campus"
 *   node scripts/seed-search-catalog.mjs --type=movie --query=barbie --dry-run
 *   node scripts/seed-search-catalog.mjs --type=tv --query=scooby --max-pages=3
 *
 * Env: MONGODB_URI, TMDB_BEARER (or NEXT_PUBLIC_TMDB_BEARER)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { mapTmdbMovieToDoc } from "../src/lib/syncMoviesTmdbDaily.js";
import { tmdbBearerToken } from "../src/lib/tmdbAuth.js";
import { shouldRejectTmdbTvFromCatalog } from "../src/lib/tmdbMovieContentPolicy.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const FETCH_TIMEOUT_MS = 20000;
const SLEEP_MS = 45;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function stringFlag(name, def) {
  const prefix = `${name}=`;
  const eq = process.argv.find((a) => a.startsWith(prefix));
  return eq ? eq.slice(prefix.length).trim() || def : def;
}

function intFlag(name, def) {
  const prefix = `${name}=`;
  const eq = process.argv.find((a) => a.startsWith(prefix));
  if (eq) {
    const n = parseInt(eq.slice(prefix.length), 10);
    if (Number.isFinite(n)) return n;
  }
  return def;
}

/** Same shape seed-popular-catalog writes for non-anime TV rows. */
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
      headers: { accept: "application/json", Authorization: `Bearer ${token}` },
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

async function searchIds(type, query, maxPages, token) {
  const endpoint = type === "tv" ? "/search/tv" : "/search/movie";
  const ids = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const q = new URLSearchParams({
      query,
      language: "en-US",
      include_adult: "false",
      page: String(page),
    });
    const json = await tmdbGet(`${endpoint}?${q}`, token);
    const results = Array.isArray(json.results) ? json.results : [];
    for (const r of results) {
      if (typeof r.id === "number" && r.id > 0 && !seen.has(r.id)) {
        seen.add(r.id);
        ids.push(r.id);
      }
    }
    if (page >= (json.total_pages || 0) || results.length === 0) break;
    await sleep(SLEEP_MS);
  }
  return ids;
}

async function fetchDoc(type, id, token) {
  if (type === "tv") {
    const q = new URLSearchParams({ language: "en-US", include_adult: "false" });
    const show = await tmdbGet(`/tv/${id}?${q}`, token);
    return mapTmdbTvToDoc(show);
  }
  const q = new URLSearchParams({
    language: "en-US",
    include_adult: "false",
    append_to_response: "release_dates",
  });
  const movie = await tmdbGet(`/movie/${id}?${q}`, token);
  return mapTmdbMovieToDoc(movie);
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const type = stringFlag("--type", "movie") === "tv" ? "tv" : "movie";
  const query = stringFlag("--query", "");
  const maxPages = Math.max(1, intFlag("--max-pages", 3));

  if (!query) {
    console.error('Missing --query (e.g. --query="off campus")');
    process.exit(1);
  }

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
    `seed search | mongo=${mongoHostHint(uri)} type=${type} query="${query}" maxPages=${maxPages} dryRun=${dryRun}`
  );

  const ids = await searchIds(type, query, maxPages, token);
  console.log(`TMDB ${type} search "${query}": ${ids.length} ids`);

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const before = await col.countDocuments({
    type,
    name: { $regex: query.split(/\s+/).join(".*"), $options: "i" },
  });
  console.log(`existing ${type} matching "${query}" in DB: ${before}`);

  const ops = [];
  let skipped = 0;
  let noPoster = 0;
  for (const id of ids) {
    try {
      const doc = await fetchDoc(type, id, token);
      await sleep(SLEEP_MS);
      if (!doc) {
        skipped += 1;
        continue;
      }
      const year = String(doc.release_date ?? doc.first_air_date ?? "").slice(0, 4) || "?";
      const poster = doc.poster_path ? "" : " [NO POSTER]";
      if (!doc.poster_path) noPoster += 1;
      console.log(`  + ${doc.id} ${doc.name} (${year})${poster}`);
      ops.push({
        updateOne: {
          filter: { type, id: doc.id },
          update: { $set: doc },
          upsert: true,
        },
      });
    } catch (e) {
      console.warn(`${type} ${id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`upsertOps=${ops.length} skippedByPolicy=${skipped} withoutPoster=${noPoster}`);

  if (dryRun) {
    console.log("dry-run: no Mongo writes");
    await client.close();
    return;
  }

  if (ops.length > 0) {
    const r = await col.bulkWrite(ops, { ordered: false });
    console.log(
      `done: upserted=${r.upsertedCount} modified=${r.modifiedCount} matched=${r.matchedCount}`
    );
  } else {
    console.log("nothing to upsert");
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
