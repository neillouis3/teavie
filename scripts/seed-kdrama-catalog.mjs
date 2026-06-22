/**
 * Upsert Korean TV into `teavie.content` and tag as K-Drama with IMDb genres.
 *
 *   node scripts/seed-kdrama-catalog.mjs
 *   node scripts/seed-kdrama-catalog.mjs --dry-run --pages=8
 *
 * Env: MONGODB_URI, TMDB_BEARER — see scripts/lib/mongoEnv.cjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { tmdbBearerToken } from "../src/lib/tmdbAuth.js";
import {
  shouldRejectTmdbTvFromCatalog,
} from "../src/lib/tmdbMovieContentPolicy.js";
import { applyImdbGenresToCatalogDoc } from "../src/lib/imdbGenres.js";

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

function mapTmdbTvToKdramaDoc(show) {
  const id = show.id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  if (shouldRejectTmdbTvFromCatalog(show)) return null;

  const origins = show.origin_country;
  const lang = String(show.original_language ?? "").toLowerCase();
  const hasKr =
    (Array.isArray(origins) &&
      origins.some((c) => String(c).toUpperCase() === "KR")) ||
    String(origins ?? "").toUpperCase() === "KR";
  if (!hasKr && lang !== "ko") return null;

  const name = show.name ?? show.original_name ?? `TV ${id}`;
  const base = {
    ...show,
    type: "tv",
    id,
    name,
    title: show.name ?? name,
    tmdb_id: id,
    season_amount:
      typeof show.number_of_seasons === "number" && show.number_of_seasons > 0
        ? show.number_of_seasons
        : show.season_amount ?? null,
    number_of_episodes:
      typeof show.number_of_episodes === "number" && show.number_of_episodes > 0
        ? show.number_of_episodes
        : null,
    updatedAt: new Date(),
    is_anime: false,
  };

  return applyImdbGenresToCatalogDoc(base);
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
    { projection: { id: 1, tmdb_id: 1, external_ids: 1 } }
  );

  for await (const d of cursor) {
    const tid = typeof d.tmdb_id === "number" ? d.tmdb_id : Number(d.tmdb_id);
    if (Number.isFinite(tid) && tid > 0) blocked.add(tid);
    const ext = d.external_ids?.tmdb_id;
    const extn = typeof ext === "number" ? ext : Number(ext);
    if (Number.isFinite(extn) && extn > 0) blocked.add(extn);
  }
  return blocked;
}

async function discoverIds(token, maxPages, sortBy) {
  const ids = [];
  const seen = new Set();
  for (let page = 1; page <= maxPages; page += 1) {
    const q = new URLSearchParams({
      language: "en-US",
      include_adult: "false",
      with_origin_country: "KR",
      with_original_language: "ko",
      sort_by: sortBy,
      page: String(page),
    });
    const json = await tmdbGet(`/discover/tv?${q}`, token);
    const results = Array.isArray(json.results) ? json.results : [];
    for (const r of results) {
      if (shouldRejectTmdbTvFromCatalog(r)) continue;
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
  const pages = Math.max(1, parseIntFlag("--pages", 5));

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
    `seed kdrama | mongo=${mongoHostHint(uri)} pages=${pages} dryRun=${dryRun}`
  );

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const animeBlocked = await animeClaimedTmdbIds(col);
  console.log(`anime-blocked TMDB tv ids: ${animeBlocked.size}`);

  const popIds = await discoverIds(token, pages, "popularity.desc");
  const ratedIds = await discoverIds(token, Math.min(pages, 3), "vote_average.desc");
  const allIds = [...new Set([...popIds, ...ratedIds])].filter(
    (id) => !animeBlocked.has(id)
  );
  console.log(`discover KR/ko tv: ${allIds.length} unique ids`);

  const ops = [];
  let ok = 0;
  let err = 0;

  for (let i = 0; i < allIds.length; i += 1) {
    const id = allIds[i];
    try {
      const q = new URLSearchParams({ language: "en-US", include_adult: "false" });
      const show = await tmdbGet(`/tv/${id}?${q}`, token);
      const doc = mapTmdbTvToKdramaDoc(show);
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
    if ((i + 1) % 20 === 0) console.log(`  fetched ${i + 1}/${allIds.length}…`);
  }
  console.log(`detail ok=${ok} err=${err}`);

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
  for (let i = 0; i < ops.length; i += batch) {
    const chunk = ops.slice(i, i + batch);
    const r = await col.bulkWrite(chunk, { ordered: false });
    upserted += r.upsertedCount;
    modified += r.modifiedCount;
    console.log(
      `bulk ${Math.min(i + chunk.length, ops.length)}/${ops.length}: upserted+=${r.upsertedCount} modified+=${r.modifiedCount}`
    );
  }

  const kdramaCount = await col.countDocuments({
    $or: [{ catalog_categories: "kdrama" }, { is_kdrama: true }],
  });
  console.log(`done: upserted=${upserted} modified=${modified} tagged_kdrama=${kdramaCount}`);
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
