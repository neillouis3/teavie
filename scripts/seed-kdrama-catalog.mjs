/**
 * Upsert Korean TV into `teavie.content` and tag as K-Drama with IMDb genres.
 *
 *   node scripts/seed-kdrama-catalog.mjs
 *   node scripts/seed-kdrama-catalog.mjs --target=5000
 *   node scripts/seed-kdrama-catalog.mjs --dry-run --pages=20
 *
 * Env: MONGODB_URI, TMDB_BEARER — see scripts/lib/mongoEnv.cjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { hasTmdbAuth, tmdbAuth, tmdbFetchJson } from "../src/lib/tmdbAuth.js";
import { fetchOmdbGenreRaw } from "../src/lib/omdbGenre.js";
import { shouldRejectTmdbTvFromCatalog } from "../src/lib/tmdbMovieContentPolicy.js";
import {
  applyImdbGenresToCatalogDoc,
  kdramaTagFields,
  omitTmdbGenreFields,
} from "../src/lib/imdbGenres.js";
import { shouldRejectKdramaFromCatalog } from "../src/lib/kdramaCatalogPolicy.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const FETCH_TIMEOUT_MS = 25000;
const SLEEP_MS = 25;

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

function mapTmdbTvToKdramaDoc(show, { omdbGenreRaw = null } = {}) {
  const id = show.id;
  if (typeof id !== "number" || !Number.isFinite(id)) return null;
  if (shouldRejectTmdbTvFromCatalog(show)) return null;
  if (shouldRejectKdramaFromCatalog(show)) return null;

  const origins = show.origin_country;
  const lang = String(show.original_language ?? "").toLowerCase();
  const hasKr =
    (Array.isArray(origins) &&
      origins.some((c) => String(c).toUpperCase() === "KR")) ||
    String(origins ?? "").toUpperCase() === "KR";
  if (!hasKr && lang !== "ko") return null;

  const name = show.name ?? show.original_name ?? `TV ${id}`;
  const ext = show.external_ids && typeof show.external_ids === "object" ? show.external_ids : null;
  const imdbFromExt =
    typeof ext?.imdb_id === "string" && /^tt/i.test(ext.imdb_id) ? ext.imdb_id.trim() : null;

  /** @type {Record<string, unknown>} */
  const base = omitTmdbGenreFields({
    ...show,
    type: "tv",
    id,
    name,
    title: show.name ?? name,
    tmdb_id: id,
    imdb_id: imdbFromExt ?? (typeof show.imdb_id === "string" ? show.imdb_id : null),
    external_ids: ext ?? show.external_ids ?? null,
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
  });

  if (omdbGenreRaw) {
    base.omdb = { ...(typeof show.omdb === "object" ? show.omdb : {}), genre: omdbGenreRaw };
  }

  const withGenres = applyImdbGenresToCatalogDoc(base);
  Object.assign(withGenres, kdramaTagFields(withGenres));
  return withGenres;
}

async function tmdbGet(pathWithQuery) {
  const url = pathWithQuery.startsWith("http")
    ? pathWithQuery
    : `${TMDB_BASE}${pathWithQuery}`;
  return tmdbFetchJson(url, tmdbAuth(), { timeoutMs: FETCH_TIMEOUT_MS });
}

function pickImagePath(images, kind) {
  const rows = Array.isArray(images?.[kind]) ? images[kind] : [];
  if (rows.length === 0) return null;
  const preferred =
    rows.find((row) => String(row?.iso_639_1 ?? "").toLowerCase() === "ko") ??
    rows.find((row) => String(row?.iso_639_1 ?? "").toLowerCase() === "en") ??
    rows.find((row) => !row?.iso_639_1) ??
    rows[0];
  const file = String(preferred?.file_path ?? "").trim();
  return file || null;
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

async function loadExistingTvIds(col) {
  const existing = new Set();
  const cursor = col.find({ type: "tv" }, { projection: { id: 1, tmdb_id: 1 } });
  for await (const d of cursor) {
    const id = Number(d.id);
    if (Number.isFinite(id) && id > 0) existing.add(id);
    const tid = Number(d.tmdb_id);
    if (Number.isFinite(tid) && tid > 0) existing.add(tid);
  }
  return existing;
}

/**
 * @param {string} token
 * @param {Record<string, string>} baseParams
 * @param {number} maxPages
 * @param {Set<number>} into
 * @param {Set<number>} blocked
 */
async function discoverInto(baseParams, maxPages, into, blocked) {
  let totalPages = 1;
  for (let page = 1; page <= maxPages && page <= totalPages; page += 1) {
    const q = new URLSearchParams({
      language: "en-US",
      include_adult: "false",
      ...baseParams,
      page: String(page),
    });
    const json = await tmdbGet(`/discover/tv?${q}`);
    totalPages = Math.min(maxPages, json.total_pages || 1);
    const results = Array.isArray(json.results) ? json.results : [];
    for (const r of results) {
      if (shouldRejectTmdbTvFromCatalog(r)) continue;
      const id = Number(r.id);
      if (!Number.isFinite(id) || id <= 0 || blocked.has(id)) continue;
      into.add(id);
    }
    if (results.length === 0) break;
    await sleep(SLEEP_MS);
    if (page % 50 === 0) {
      console.log(`  discover [${baseParams.sort_by}] page ${page}/${totalPages} pool=${into.size}`);
    }
  }
}

/** Build discover passes to maximize KR/ko TV coverage on TMDB (~9.5k titles). */
function discoverPlans(maxPages) {
  const sorts = [
    "popularity.desc",
    "first_air_date.desc",
    "first_air_date.asc",
    "vote_average.desc",
  ];
  /** @type {{ params: Record<string, string>; maxPages: number }[]} */
  const plans = [];

  for (const sort_by of sorts) {
    plans.push({
      maxPages,
      params: {
        with_origin_country: "KR",
        with_original_language: "ko",
        sort_by,
      },
    });
  }

  plans.push({
    maxPages: Math.min(maxPages, 200),
    params: { with_origin_country: "KR", sort_by: "popularity.desc" },
  });
  plans.push({
    maxPages: Math.min(maxPages, 200),
    params: { with_original_language: "ko", sort_by: "popularity.desc" },
  });

  const year = new Date().getFullYear();
  for (let y = year; y >= 1970; y -= 1) {
    plans.push({
      maxPages: 20,
      params: {
        with_origin_country: "KR",
        with_original_language: "ko",
        sort_by: "popularity.desc",
        "first_air_date.gte": `${y}-01-01`,
        "first_air_date.lte": `${y}-12-31`,
      },
    });
  }

  return plans;
}

async function fetchAndMapShow(id, { fetchOmdb = true } = {}) {
  let show = null;
  for (const language of ["en-US", "ko-KR"]) {
    const q = new URLSearchParams({
      language,
      include_adult: "false",
      append_to_response: "external_ids",
    });
    const next = await tmdbGet(`/tv/${id}?${q}`);
    show = next;
    if (String(next?.poster_path ?? "").trim()) break;
  }

  if (show && !String(show?.poster_path ?? "").trim()) {
    try {
      const images = await tmdbGet(`/tv/${id}/images`);
      const poster = pickImagePath(images, "posters");
      const backdrop = pickImagePath(images, "backdrops");
      if (poster) show = { ...show, poster_path: poster };
      if (backdrop && !String(show?.backdrop_path ?? "").trim()) {
        show = { ...show, backdrop_path: backdrop };
      }
    } catch {
      /* optional */
    }
  }

  let omdbGenreRaw = null;
  const imdbId =
    typeof show?.external_ids?.imdb_id === "string" &&
    /^tt/i.test(show.external_ids.imdb_id)
      ? show.external_ids.imdb_id.trim()
      : null;

  if (fetchOmdb && imdbId) {
    omdbGenreRaw = await fetchOmdbGenreRaw(imdbId, "tv");
    await sleep(120);
  }

  return mapTmdbTvToKdramaDoc(show, { omdbGenreRaw });
}

async function mapPoolConcurrent(ids, concurrency) {
  /** @type {Record<string, unknown>[]} */
  const docs = [];
  let err = 0;
  let idx = 0;

  async function worker() {
    while (idx < ids.length) {
      const i = idx;
      idx += 1;
      const id = ids[i];
      try {
        const doc = await fetchAndMapShow(id);
        if (doc) docs.push(doc);
      } catch (e) {
        err += 1;
        if (err <= 5) {
          console.warn(`tv ${id}: ${e instanceof Error ? e.message : e}`);
        }
      }
      await sleep(SLEEP_MS);
      if ((i + 1) % 100 === 0) {
        console.log(`  fetched ${i + 1}/${ids.length} (docs=${docs.length} err=${err})`);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);
  return { docs, err };
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const maxPages = Math.max(1, parseIntFlag("--pages", 500));
  const target = Math.max(1, parseIntFlag("--target", 5000));
  const concurrency = Math.min(12, Math.max(1, parseIntFlag("--concurrency", 8)));

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!hasTmdbAuth()) {
    console.error("Missing TMDB_BEARER or TMDB_API_KEY");
    process.exit(1);
  }

  console.log(
    `seed kdrama | mongo=${mongoHostHint(uri)} target=${target} pages=${maxPages} concurrency=${concurrency} dryRun=${dryRun}`
  );

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const currentTagged = await col.countDocuments({
    $or: [{ catalog_categories: "kdrama" }, { is_kdrama: true }],
  });
  console.log(`current tagged kdrama: ${currentTagged}`);

  if (currentTagged >= target) {
    console.log(`already at target (${currentTagged} >= ${target})`);
    await client.close();
    return;
  }

  const need = target - currentTagged;
  console.log(`need ~${need} more kdrama titles`);

  const [animeBlocked, existingTv] = await Promise.all([
    animeClaimedTmdbIds(col),
    loadExistingTvIds(col),
  ]);
  console.log(`anime-blocked TMDB ids: ${animeBlocked.size}`);
  console.log(`existing tv ids in catalog: ${existingTv.size}`);

  const pool = new Set();
  const plans = discoverPlans(maxPages);
  console.log(`running ${plans.length} discover passes…`);

  for (const plan of plans) {
    await discoverInto(plan.params, plan.maxPages, pool, animeBlocked);
    const newCount = [...pool].filter((id) => !existingTv.has(id)).length;
    console.log(`  pool=${pool.size} new-vs-catalog=${newCount}`);
    if (newCount >= need) break;
  }

  const newIds = [...pool].filter((id) => !existingTv.has(id));
  console.log(`discover complete: ${newIds.length} new ids to import`);

  const toFetch = newIds.slice(0, need + Math.ceil(need * 0.05));
  console.log(`fetching details for ${toFetch.length} shows…`);

  const { docs, err } = await mapPoolConcurrent(toFetch, concurrency);
  console.log(`detail docs=${docs.length} fetchErrors=${err}`);

  const ops = docs.map((doc) => ({
    updateOne: {
      filter: { type: "tv", id: doc.id },
      update: { $set: doc },
      upsert: true,
    },
  }));

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
  console.log(
    `done: upserted=${upserted} modified=${modified} tagged_kdrama=${kdramaCount} (target=${target})`
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
