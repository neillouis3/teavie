/**
 * Refresh `imdb_genres` from OMDb for all movie/TV rows with an IMDb id.
 * OMDb genres are the canonical source (same taxonomy for movies and TV).
 *
 *   node scripts/refresh-omdb-genres.mjs
 *   node scripts/refresh-omdb-genres.mjs --dry-run --limit=100
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
const SLEEP_MS = 120;

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

  const uri = String(process.env.MONGODB_URI ?? "").trim();
  if (!uri) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  console.log(
    `refresh omdb genres | mongo=${mongoHostHint(uri)} dryRun=${dryRun} limit=${limit || "all"}`
  );

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(DB_NAME).collection(COLLECTION);

  let cursor = col.find(
    {
      type: { $in: ["movie", "tv"] },
      imdb_id: { $type: "string", $regex: /^tt/i },
    },
    {
      projection: {
        type: 1,
        id: 1,
        title: 1,
        name: 1,
        imdb_id: 1,
        imdb_genres: 1,
        omdb: 1,
        genres: 1,
        genre_ids: 1,
        is_anime: 1,
        anilist: 1,
      },
    }
  );

  if (limit > 0) cursor = cursor.limit(limit);

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for await (const doc of cursor) {
    scanned += 1;
    const imdbId = String(doc.imdb_id ?? "").trim();
    const genreRaw = await fetchOmdbGenreRaw(imdbId, doc.type);
    await sleep(SLEEP_MS);

    if (!genreRaw) {
      skipped += 1;
      continue;
    }

    const enriched = {
      ...doc,
      omdb: { ...(doc.omdb ?? {}), genre: genreRaw },
    };
    const normalized = applyImdbGenresToCatalogDoc(enriched);
    const nextGenres = normalized.imdb_genres ?? [];
    const prevGenres = Array.isArray(doc.imdb_genres) ? doc.imdb_genres : [];
    const changed =
      JSON.stringify(prevGenres) !== JSON.stringify(nextGenres) ||
      doc.genres != null ||
      doc.genre_ids != null;

    if (!changed) {
      skipped += 1;
      continue;
    }

    updated += 1;
    const label = doc.title ?? doc.name ?? doc.id;
    console.log(
      `${dryRun ? "[dry-run] " : ""}${doc.type} ${doc.id} ${label}: ${nextGenres.join(", ")}`
    );

    if (!dryRun) {
      await col.updateOne(
        { _id: doc._id },
        {
          $set: {
            imdb_genres: nextGenres,
            omdb: enriched.omdb,
          },
          $unset: { genre_ids: "", genres: "", mal_genre_names: "" },
        }
      );
    }
  }

  await client.close();
  console.log(`done scanned=${scanned} updated=${updated} skipped=${skipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
