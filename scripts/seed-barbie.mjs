/**
 * Targeted catalog seed for "Barbie" movies. The generic OMDb-term seed
 * (`seed-movies-omdb-filtered.mjs`) never searches "barbie", and the daily
 * TMDB sync only covers a ±30d window, so Barbie (2023) was never added.
 *
 * List comes from TMDB **search** (`/search/movie?query=barbie`); each hit gets a
 * full detail fetch (`/movie/{id}` + release_dates) and is mapped with the same
 * `mapTmdbMovieToDoc` used everywhere else, so Mongo keeps a consistent shape.
 *
 *   node scripts/seed-barbie.mjs
 *   node scripts/seed-barbie.mjs --dry-run
 *   node scripts/seed-barbie.mjs --query=barbie --max-pages=3
 *
 * Env: MONGODB_URI, TMDB_BEARER (or NEXT_PUBLIC_TMDB_BEARER)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { mapTmdbMovieToDoc } from "../src/lib/syncMoviesTmdbDaily.js";
import { tmdbBearerToken } from "../src/lib/tmdbAuth.js";

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

async function searchMovieIds(query, maxPages, token) {
  const ids = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const q = new URLSearchParams({
      query,
      language: "en-US",
      include_adult: "false",
      page: String(page),
    });
    const json = await tmdbGet(`/search/movie?${q}`, token);
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

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const query = stringFlag("--query", "barbie");
  const maxPages = Math.max(1, intFlag("--max-pages", 3));

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
    `seed barbie | mongo=${mongoHostHint(uri)} query="${query}" maxPages=${maxPages} dryRun=${dryRun}`
  );

  const ids = await searchMovieIds(query, maxPages, token);
  console.log(`TMDB search "${query}": ${ids.length} movie ids`);

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const before = await col.countDocuments({
    type: "movie",
    name: { $regex: query, $options: "i" },
  });
  console.log(`existing movies matching /${query}/i in DB: ${before}`);

  const ops = [];
  let skipped = 0;
  for (const id of ids) {
    try {
      const q = new URLSearchParams({
        language: "en-US",
        include_adult: "false",
        append_to_response: "release_dates",
      });
      const movie = await tmdbGet(`/movie/${id}?${q}`, token);
      await sleep(SLEEP_MS);
      const doc = mapTmdbMovieToDoc(movie);
      if (!doc) {
        skipped += 1;
        continue;
      }
      console.log(
        `  + ${doc.id} ${doc.name} (${String(doc.release_date ?? "").slice(0, 4) || "?"})`
      );
      ops.push({
        updateOne: {
          filter: { type: "movie", id: doc.id },
          update: { $set: doc },
          upsert: true,
        },
      });
    } catch (e) {
      console.warn(`movie ${id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`upsertOps=${ops.length} skippedByPolicy=${skipped}`);

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
