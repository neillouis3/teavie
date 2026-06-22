/**
 * Fill empty `imdb_genres` from OMDb (IMDb ids via TMDB external_ids lookup only).
 * Anime without OMDb uses AniList → IMDb mapping. No TMDB genre fallback.
 *
 *   node scripts/fill-missing-imdb-genres.mjs
 *   node scripts/fill-missing-imdb-genres.mjs --dry-run
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { tmdbBearerToken } from "../src/lib/tmdbAuth.js";
import { omdbApiKey } from "../src/lib/omdbAuth.js";
import { applyImdbGenresToCatalogDoc } from "../src/lib/imdbGenres.js";
import { fetchOmdbGenreRaw } from "../src/lib/omdbGenre.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const TMDB_BASE = "https://api.themoviedb.org/3";
const TMDB_SLEEP_MS = 30;
const OMDB_SLEEP_MS = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function missingGenresQuery() {
  return {
    $and: [
      { type: { $in: ["movie", "tv"] } },
      {
        $or: [
          { imdb_genres: { $exists: false } },
          { imdb_genres: null },
          { imdb_genres: { $size: 0 } },
        ],
      },
    ],
  };
}

function tmdbIdFromDoc(doc) {
  const fromField =
    typeof doc.tmdb_id === "number"
      ? doc.tmdb_id
      : typeof doc.tmdb_id === "string"
        ? Number(doc.tmdb_id)
        : NaN;
  if (Number.isFinite(fromField) && fromField > 0) return fromField;
  const idNum = typeof doc.id === "number" ? doc.id : Number(doc.id);
  if (Number.isFinite(idNum) && idNum > 0 && !String(doc.id).startsWith("anime_")) {
    return idNum;
  }
  return null;
}

async function tmdbExternalImdbId(tmdbId, type, token) {
  const segment = type === "movie" ? "movie" : "tv";
  const res = await fetch(`${TMDB_BASE}/${segment}/${tmdbId}/external_ids`, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const imdbId = data?.imdb_id;
  return typeof imdbId === "string" && /^tt/i.test(imdbId) ? imdbId.trim() : null;
}

async function enrichDocGenres(doc, token) {
  /** @type {Record<string, unknown>} */
  let merged = { ...doc };
  let imdbId =
    typeof merged.imdb_id === "string" && /^tt/i.test(merged.imdb_id)
      ? merged.imdb_id.trim()
      : "";

  if (!imdbId && !String(doc.id ?? "").startsWith("anime_")) {
    const tmdbId = tmdbIdFromDoc(doc);
    if (tmdbId != null && token) {
      imdbId = await tmdbExternalImdbId(tmdbId, doc.type, token);
      await sleep(TMDB_SLEEP_MS);
      if (imdbId) {
        merged.imdb_id = imdbId;
        merged.external_ids = {
          ...(typeof merged.external_ids === "object" ? merged.external_ids : {}),
          imdb_id: imdbId,
          tmdb_id: tmdbId,
        };
      }
    }
  }

  const omdb =
    merged.omdb && typeof merged.omdb === "object"
      ? { ...merged.omdb }
      : {};
  const hasOmdb =
    typeof omdb.genre === "string" && omdb.genre.trim() && omdb.genre !== "N/A";

  if (imdbId && !hasOmdb) {
    const genreRaw = await fetchOmdbGenreRaw(imdbId, doc.type);
    await sleep(OMDB_SLEEP_MS);
    if (genreRaw) {
      omdb.genre = genreRaw;
      merged = { ...merged, imdb_id: imdbId, omdb };
    }
  }

  const normalized = applyImdbGenresToCatalogDoc(merged);
  return { normalized, enriched: merged };
}

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  const token = tmdbBearerToken().trim();

  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!token) {
    console.error("Missing TMDB_BEARER");
    process.exit(1);
  }

  console.log(
    `fill missing imdb genres (omdb only) | mongo=${mongoHostHint(uri)} dryRun=${dryRun} omdb=${omdbApiKey() ? "yes" : "no"}`
  );

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  const cursor = col.find(missingGenresQuery(), {
    projection: {
      type: 1,
      id: 1,
      tmdb_id: 1,
      imdb_id: 1,
      title: 1,
      name: 1,
      omdb: 1,
      is_anime: 1,
      catalog_categories: 1,
      anilist: 1,
      external_ids: 1,
    },
  });

  let scanned = 0;
  let filled = 0;
  let stillEmpty = 0;
  let errors = 0;
  const ops = [];

  for await (const doc of cursor) {
    scanned += 1;
    try {
      const { normalized, enriched } = await enrichDocGenres(doc, token);
      const imdb_genres = normalized.imdb_genres ?? [];
      if (!imdb_genres.length) {
        stillEmpty += 1;
        continue;
      }

      /** @type {Record<string, unknown>} */
      const set = { imdb_genres };
      if (normalized.is_kdrama === true) {
        set.is_kdrama = true;
        set.catalog_categories = normalized.catalog_categories;
      }
      if (enriched.omdb?.genre && !doc.omdb?.genre) {
        set.omdb = enriched.omdb;
      }
      if (enriched.imdb_id && !doc.imdb_id) {
        set.imdb_id = enriched.imdb_id;
      }
      if (enriched.external_ids) {
        set.external_ids = enriched.external_ids;
      }

      if (!dryRun) {
        ops.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: set,
              $unset: { genre_ids: "", genres: "", mal_genre_names: "" },
            },
          },
        });
        if (ops.length >= 100) {
          await col.bulkWrite(ops, { ordered: false });
          ops.length = 0;
        }
      }
      filled += 1;
    } catch (e) {
      errors += 1;
      console.warn(
        `doc ${doc.id}: ${e instanceof Error ? e.message : String(e)}`
      );
    }

    if (scanned % 25 === 0) {
      console.log(`progress scanned=${scanned} filled=${filled} empty=${stillEmpty}`);
    }
  }

  if (!dryRun && ops.length > 0) {
    await col.bulkWrite(ops, { ordered: false });
  }

  const remaining = await col.countDocuments(missingGenresQuery());
  const withImdb = await col.countDocuments({
    imdb_genres: { $exists: true, $ne: [] },
  });
  console.log(
    `done: scanned=${scanned} filled=${filled} still_empty=${stillEmpty} errors=${errors} remaining=${remaining} catalog_with_genres=${withImdb}`
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
