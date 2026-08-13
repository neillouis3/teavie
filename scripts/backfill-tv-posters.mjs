/**
 * Backfill posters for catalog TV rows missing `poster_path`.
 * Supports kdrama-only mode and TMDB images + OMDb fallbacks.
 *
 *   node scripts/backfill-tv-posters.mjs
 *   node scripts/backfill-tv-posters.mjs --kdrama-only --cap=2000
 *   node scripts/backfill-tv-posters.mjs --dry-run --cap=50
 *
 * Env: MONGODB_URI, TMDB_BEARER or TMDB_API_KEY, OMDB_API_KEY (optional fallback)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { hasTmdbAuth, tmdbAuth, tmdbFetchJson } from "../src/lib/tmdbAuth.js";
import { omdbApiKey, omdbQueryWithKey } from "../src/lib/omdbAuth.js";

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
const SLEEP_MS = 40;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasFlag(flag) {
  return process.argv.includes(flag);
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

async function tmdbGet(pathWithQuery) {
  const url = pathWithQuery.startsWith("http")
    ? pathWithQuery
    : `${TMDB_BASE}${pathWithQuery}`;
  return tmdbFetchJson(url, tmdbAuth(), { timeoutMs: FETCH_TIMEOUT_MS });
}

function kdramaFilter() {
  return {
    $or: [{ catalog_categories: "kdrama" }, { is_kdrama: true }],
  };
}

function missingPosterFilter() {
  return {
    $or: [
      { poster_path: { $exists: false } },
      { poster_path: null },
      { poster_path: "" },
    ],
  };
}

/** TMDB tv id for a doc: numeric `tmdb_id` first, then numeric `id`. */
function tmdbIdForDoc(doc) {
  const t = typeof doc.tmdb_id === "number" ? doc.tmdb_id : Number(doc.tmdb_id);
  if (Number.isFinite(t) && t > 0) return t;
  const i = typeof doc.id === "number" ? doc.id : Number(doc.id);
  if (Number.isFinite(i) && i > 0) return i;
  return null;
}

function pickImagePath(images, kind) {
  const rows = Array.isArray(images?.[kind]) ? images[kind] : [];
  if (rows.length === 0) return null;
  const en =
    rows.find((row) => String(row?.iso_639_1 ?? "").toLowerCase() === "en") ??
    rows.find((row) => !row?.iso_639_1) ??
    rows[0];
  const file = String(en?.file_path ?? "").trim();
  return file || null;
}

async function fetchOmdbPoster(imdbId) {
  const id = String(imdbId ?? "").trim();
  if (!/^tt\d+$/i.test(id)) return null;
  const key = omdbApiKey();
  if (!key) return null;

  const qs = omdbQueryWithKey({ i: id, type: "series", plot: "short", r: "json" });
  if (!qs.includes("apikey=")) return null;

  const res = await fetch(`${OMDB_BASE}?${qs}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  const payload = await res.json().catch(() => null);
  const raw = typeof payload?.Poster === "string" ? payload.Poster.trim() : "";
  if (!raw || raw === "N/A" || !/^https?:\/\//i.test(raw)) return null;
  return raw;
}

async function resolveTvPosterPaths(doc) {
  const tmdbId = tmdbIdForDoc(doc);
  if (tmdbId == null) return null;

  let posterPath = null;
  let backdropPath = null;
  let source = null;

  try {
    for (const language of ["en-US", "ko-KR"]) {
      const show = await tmdbGet(
        `/tv/${tmdbId}?language=${language}&include_adult=false&append_to_response=external_ids`
      );
      posterPath = String(show?.poster_path ?? "").trim() || posterPath;
      backdropPath = String(show?.backdrop_path ?? "").trim() || backdropPath;
      if (posterPath) {
        source = language === "ko-KR" ? "tmdb_detail_ko" : "tmdb_detail";
        break;
      }
    }

    if (!posterPath) {
      const images = await tmdbGet(`/tv/${tmdbId}/images`);
      posterPath = pickImagePath(images, "posters");
      if (!backdropPath) backdropPath = pickImagePath(images, "backdrops");
      if (posterPath) source = "tmdb_images";
    }

    if (!posterPath) {
      const show = await tmdbGet(
        `/tv/${tmdbId}?language=en-US&include_adult=false&append_to_response=external_ids`
      );
      const imdbId =
        String(doc.imdb_id ?? "").trim() ||
        String(show?.external_ids?.imdb_id ?? "").trim();
      if (/^tt/i.test(imdbId)) {
        const omdbPoster = await fetchOmdbPoster(imdbId);
        if (omdbPoster) {
          posterPath = omdbPoster;
          if (!backdropPath) backdropPath = omdbPoster;
          source = "omdb";
        }
      }
    }
  } catch {
    return null;
  }

  if (!posterPath) return null;

  /** @type {Record<string, unknown>} */
  const patch = {
    poster_path: posterPath,
    updatedAt: new Date(),
    last_poster_source: source,
  };
  if (backdropPath) patch.backdrop_path = backdropPath;
  return patch;
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const kdramaOnly = hasFlag("--kdrama-only");
  const cap = Math.max(1, intFlag("--cap", kdramaOnly ? 2000 : 500));

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!hasTmdbAuth()) {
    console.error("Missing TMDB_BEARER or TMDB_API_KEY");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  /** @type {Record<string, unknown>} */
  const filter = {
    type: "tv",
    id: { $not: { $regex: "^anime_" } },
    $and: [missingPosterFilter(), ...(kdramaOnly ? [kdramaFilter()] : [])],
  };

  const missing = await col
    .find(filter, {
      projection: { id: 1, tmdb_id: 1, name: 1, imdb_id: 1 },
    })
    .limit(cap)
    .toArray();

  console.log(
    `backfill tv posters | mongo=${mongoHostHint(uri)} kdramaOnly=${kdramaOnly} candidates=${missing.length} cap=${cap} dryRun=${dryRun}`
  );

  const ops = [];
  let stillNoPoster = 0;
  let skipped = 0;
  let err = 0;

  for (let i = 0; i < missing.length; i += 1) {
    const d = missing[i];
    const tmdbId = tmdbIdForDoc(d);
    if (tmdbId == null) {
      skipped += 1;
      continue;
    }
    try {
      const patch = await resolveTvPosterPaths(d);
      await sleep(SLEEP_MS);
      if (!patch?.poster_path) {
        stillNoPoster += 1;
        continue;
      }
      console.log(
        `  + ${d.id} ${d.name ?? ""} -> ${String(patch.poster_path).slice(0, 48)}… (${patch.last_poster_source})`
      );
      ops.push({
        updateOne: {
          filter: { type: "tv", id: d.id },
          update: { $set: patch },
          upsert: false,
        },
      });
    } catch (e) {
      err += 1;
      console.warn(`tv ${tmdbId}: ${e instanceof Error ? e.message : e}`);
    }
    if ((i + 1) % 40 === 0) console.log(`  processed ${i + 1}/${missing.length}…`);
  }

  console.log(
    `fixable=${ops.length} stillNoPoster=${stillNoPoster} skipped=${skipped} errors=${err}`
  );

  if (dryRun) {
    console.log("dry-run: no Mongo writes");
    await client.close();
    return;
  }

  if (ops.length > 0) {
    const batch = 100;
    let modified = 0;
    for (let j = 0; j < ops.length; j += batch) {
      const r = await col.bulkWrite(ops.slice(j, j + batch), { ordered: false });
      modified += r.modifiedCount;
    }
    console.log(`done: modified=${modified}`);
  } else {
    console.log("nothing to update");
  }

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
