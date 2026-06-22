/**
 * Remove TMDB genre fields and rebuild `imdb_genres` from OMDb / AniList only.
 * Does not delete catalog titles.
 *
 *   node scripts/purge-tmdb-genres.mjs
 *   node scripts/purge-tmdb-genres.mjs --dry-run
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { MongoClient } from "mongodb";
import { applyImdbGenresToCatalogDoc } from "../src/lib/imdbGenres.js";
import { fetchOmdbGenreRaw } from "../src/lib/omdbGenre.js";

const require = createRequire(import.meta.url);
const { loadMongoEnv, mongoHostHint } = require(path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "lib/mongoEnv.cjs"
));

const DB_NAME = "teavie";
const COLLECTION = "content";
const OMDB_SLEEP_MS = 120;

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

async function main() {
  loadMongoEnv();
  const dryRun = hasFlag("--dry-run");
  const limit = parseIntFlag("--limit", 0);
  const fetchOmdb = !hasFlag("--skip-omdb");

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  console.log(
    `purge tmdb genres | mongo=${mongoHostHint(uri)} dryRun=${dryRun} fetchOmdb=${fetchOmdb} limit=${limit || "all"}`
  );

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  if (!dryRun) {
    const strip = await col.updateMany(
      {},
      { $unset: { genres: "", genre_ids: "", mal_genre_names: "" } }
    );
    console.log(`stripped tmdb genre fields from ${strip.modifiedCount} docs`);
  }

  let cursor = col.find(
    {},
    {
      projection: {
        type: 1,
        id: 1,
        title: 1,
        name: 1,
        imdb_id: 1,
        imdb_genres: 1,
        omdb: 1,
        is_anime: 1,
        anilist: 1,
        is_kdrama: 1,
        catalog_categories: 1,
      },
    }
  );
  if (limit > 0) cursor = cursor.limit(limit);

  let scanned = 0;
  let updated = 0;
  let omdbFetched = 0;
  /** @type {import('mongodb').AnyBulkWriteOperation[]} */
  const ops = [];

  for await (const doc of cursor) {
    scanned += 1;
    /** @type {Record<string, unknown>} */
    let merged = { ...doc };

    const imdbId =
      typeof merged.imdb_id === "string" && /^tt/i.test(merged.imdb_id)
        ? merged.imdb_id.trim()
        : "";

    const hasOmdb =
      typeof merged.omdb?.genre === "string" &&
      merged.omdb.genre.trim() &&
      merged.omdb.genre !== "N/A";

    if (fetchOmdb && imdbId && !hasOmdb) {
      const genreRaw = await fetchOmdbGenreRaw(imdbId, doc.type === "movie" ? "movie" : "tv");
      await sleep(OMDB_SLEEP_MS);
      if (genreRaw) {
        merged = {
          ...merged,
          omdb: { ...(merged.omdb ?? {}), genre: genreRaw },
        };
        omdbFetched += 1;
      }
    }

    const normalized = applyImdbGenresToCatalogDoc(merged);
    const nextGenres = normalized.imdb_genres ?? [];
    const prevGenres = Array.isArray(doc.imdb_genres) ? doc.imdb_genres : [];
    const changed = JSON.stringify(prevGenres) !== JSON.stringify(nextGenres);

    if (changed) updated += 1;

    if (!dryRun) {
      /** @type {Record<string, unknown>} */
      const set = { imdb_genres: nextGenres };
      if (merged.omdb) set.omdb = merged.omdb;
      if (normalized.is_kdrama === true) {
        set.is_kdrama = true;
        set.catalog_categories = normalized.catalog_categories;
      }

      ops.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: set,
            $unset: { genres: "", genre_ids: "", mal_genre_names: "" },
          },
        },
      });

      if (ops.length >= 200) {
        await col.bulkWrite(ops, { ordered: false });
        ops.length = 0;
      }
    }

    if (scanned % 100 === 0) {
      console.log(`progress scanned=${scanned} updated=${updated} omdb_fetched=${omdbFetched}`);
    }
  }

  if (!dryRun && ops.length > 0) {
    await col.bulkWrite(ops, { ordered: false });
  }

  const withGenres = await col.countDocuments({
    imdb_genres: { $exists: true, $not: { $size: 0 } },
  });
  const withOmdb = await col.countDocuments({
    "omdb.genre": { $exists: true, $ne: null, $ne: "N/A" },
  });
  const withTmdbFields = await col.countDocuments({
    $or: [{ genres: { $exists: true } }, { genre_ids: { $exists: true } }],
  });

  console.log(
    `done scanned=${scanned} updated=${updated} omdb_fetched=${omdbFetched} with_imdb_genres=${withGenres} with_omdb=${withOmdb} remaining_tmdb_fields=${withTmdbFields}`
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
